import { NearestFilter, Quaternion, SRGBColorSpace, Vector3 } from 'three'

import { BACK_BONE, HAT_BONE, NECK_OFFSET_BONE, PART_SLOTS } from '../bloxity/avatarAssets'

/**
 * Rig manipulation for the base `player.glb` character.
 *
 * The rig's real structure (confirmed by reading player.glb directly):
 *   character
 *     - default_arm_L / default_arm_R / default_head
 *     - default_leg_L / default_leg_R / default_torso   (6 SkinnedMeshes, 1 skeleton)
 *     - Rig1
 *         - Spine1 > Spine2 > { ArmL_Offset > ArmL1 > ArmL2,
 *                               ArmR_Offset > ArmR1 > ArmR2,
 *                               Neck_Offset > Neck1 }
 *         - LegL_Offset > LegL1 > LegL2, LegR_Offset > LegR1 > LegR2
 *
 * Two consequences drive everything below:
 *  1. Body parts are NOT attached to bones. Each is a separate SkinnedMesh sharing one
 *     skeleton, so equipping a part means swapping that mesh's geometry (remapping
 *     skin indices into the base skeleton's bone order first).
 *  2. Accessories DO attach to bones: hats to `Neck1`, back items to `Spine2`.
 *
 * player.glb ships no animation clips, so the character is posed, not animated.
 */

/**
 * Walks the loaded rig and collects everything later operations need.
 *
 * @param {import('three').Object3D} root
 */
export function collectRig(root) {
  const rig = {
    root,
    skeleton: null,
    /** slot -> SkinnedMesh */
    partMeshes: {},
    /** slot -> the pristine geometry to restore on unequip */
    originalGeometries: {},
    /** bone name -> { bone, origPos, origQuat, origScale } */
    bones: {},
    hatBone: null,
    backBone: null,
    neckOffsetBindY: 0,
    skinnedMeshes: [],
    /** Rest Y of the character root, so the run-cycle bob can return to it. */
    rootRestY: root.position.y,
  }

  const meshBySlot = new Map(
    Object.entries(PART_SLOTS).map(([slot, cfg]) => [cfg.mesh.toLowerCase(), slot]),
  )

  root.traverse((node) => {
    if (node.isSkinnedMesh) {
      node.castShadow = true
      node.receiveShadow = true
      rig.skinnedMeshes.push(node)
      if (!rig.skeleton) rig.skeleton = node.skeleton

      const slot = meshBySlot.get((node.name || '').toLowerCase())
      if (slot) {
        rig.partMeshes[slot] = node
        rig.originalGeometries[slot] = node.geometry.clone()
      }
    } else if (node.isMesh) {
      node.castShadow = true
      node.receiveShadow = true
    }
  })

  // SkeletonUtils.clone gives every skinned mesh its own Skeleton copy over the same
  // bones, so each one re-uploads an identical bone texture every frame. When the
  // bone lists match exactly, drive all parts from one skeleton instead.
  for (const mesh of rig.skinnedMeshes) {
    const s = mesh.skeleton
    if (!rig.skeleton || s === rig.skeleton) continue
    const shared = rig.skeleton.bones
    if (s.bones.length === shared.length && s.bones.every((b, i) => b === shared[i])) {
      mesh.skeleton = rig.skeleton
    }
  }

  const skeleton = rig.skeleton
  if (skeleton) {
    for (const bone of skeleton.bones) {
      // Proportions are re-applied every frame from these rest values.
      bone.matrixAutoUpdate = true
      rig.bones[bone.name] = {
        bone,
        origPos: bone.position.clone(),
        origQuat: bone.quaternion.clone(),
        origScale: bone.scale.clone(),
      }
    }

    // Bone local axes are NOT world-aligned in this rig: a limb bone's local X
    // points along world -Z and its local Z along world -X, so rotating a leg about
    // its local X swings it sideways instead of forward/back. The offsets differ per
    // bone (Spine1 is identity, ArmL2 is off by ~14 degrees), so rather than hardcode
    // an axis, record for each bone the local-space axis matching each character-space
    // axis and animate about those.
    root.updateMatrixWorld(true)
    const rootQuat = new Quaternion()
    root.getWorldQuaternion(rootQuat)
    const rootQuatInv = rootQuat.invert()
    const boneWorld = new Quaternion()

    for (const bone of skeleton.bones) {
      const entry = rig.bones[bone.name]
      if (!entry) continue
      bone.getWorldQuaternion(boneWorld)
      // Bone orientation relative to the character, then inverted: this maps a
      // character-space axis into the bone's own local frame.
      const relInv = rootQuatInv.clone().multiply(boneWorld).invert()
      /** Local axis to rotate about for forward/back swing. */
      entry.axisX = new Vector3(1, 0, 0).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for lateral sway. */
      entry.axisZ = new Vector3(0, 0, 1).applyQuaternion(relInv).normalize()
      /** Local axis to rotate about for a twist (the character's vertical). */
      entry.axisY = new Vector3(0, 1, 0).applyQuaternion(relInv).normalize()
    }

    rig.hatBone = skeleton.bones.find((b) => b.name === HAT_BONE) || null
    rig.backBone = skeleton.bones.find((b) => b.name === BACK_BONE) || null

    const neckIndex = skeleton.bones.findIndex((b) => b.name === NECK_OFFSET_BONE)
    if (neckIndex >= 0) {
      // elements[13] is the Y translation of the inverted bind matrix.
      rig.neckOffsetBindY = skeleton.boneInverses[neckIndex].clone().invert().elements[13]
    }
  }

  return rig
}

/**
 * Bloxity textures are authored unflipped and pixel-art filtered.
 *
 * They are also sRGB images. A plain TextureLoader leaves them tagged as linear, which
 * makes three skip the sRGB decode and the avatar renders pale and washed out.
 */
export function configureAvatarTexture(texture) {
  if (!texture) return texture
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/**
 * Applies the skin texture to every skinned mesh of the base body.
 * The base body ships with an empty texture, so this always runs - with skin "0"
 * standing in when nothing is equipped.
 */
export function applySkin(rig, texture) {
  if (!texture) return
  for (const mesh of rig.skinnedMeshes) {
    if (!mesh.material) continue
    mesh.material.map = texture
    mesh.material.needsUpdate = true
  }
}

/**
 * Swaps a body part's geometry onto its base skinned mesh.
 *
 * A part GLB carries its own skeleton whose bone *order* may differ from the base
 * rig's. Its `skinIndex` attribute therefore has to be remapped by bone name, or the
 * limb deforms against the wrong bones.
 *
 * @param {object} rig from `collectRig`
 * @param {string} slot key of PART_SLOTS
 * @param {import('three').Object3D|null} partScene loaded GLB scene, or null to reset
 */
export function applyPart(rig, slot, partScene) {
  const targetMesh = rig.partMeshes[slot]
  if (!targetMesh) return

  // Unequipped / failed download: restore the part baked into player.glb.
  if (!partScene) {
    const original = rig.originalGeometries[slot]
    if (original && targetMesh.geometry !== original) targetMesh.geometry = original
    return
  }

  let skinnedSource = null
  let plainSource = null
  partScene.traverse((node) => {
    if (node.isSkinnedMesh && !skinnedSource) skinnedSource = node
    else if (node.isMesh && !plainSource) plainSource = node
  })

  if (!skinnedSource) {
    // Some parts ship as plain meshes; use them as-is.
    if (plainSource) targetMesh.geometry = plainSource.geometry
    return
  }

  const baseSkeleton = rig.skeleton
  if (!baseSkeleton || !skinnedSource.skeleton) {
    targetMesh.geometry = skinnedSource.geometry
    return
  }

  const geometry = skinnedSource.geometry.clone()

  const baseIndexByName = new Map()
  baseSkeleton.bones.forEach((bone, i) => baseIndexByName.set(bone.name, i))

  const remap = new Map()
  skinnedSource.skeleton.bones.forEach((bone, i) => {
    const baseIndex = baseIndexByName.get(bone.name)
    if (baseIndex !== undefined) remap.set(i, baseIndex)
  })

  const skinIndex = geometry.getAttribute('skinIndex')
  if (skinIndex) {
    const array = skinIndex.array
    for (let i = 0; i < array.length; i += 1) {
      const mapped = remap.get(array[i])
      if (mapped !== undefined) array[i] = mapped
    }
    skinIndex.needsUpdate = true
  }

  targetMesh.geometry = geometry
}

/**
 * Attaches a hat or back accessory to its bone.
 * Offsets are the SDK's own: hats sit at y=0.8 on `Neck1`, back items at the origin
 * of `Spine2`.
 */
export function attachAccessory(rig, kind, object) {
  const bone = kind === 'hat' ? rig.hatBone : rig.backBone
  if (!object || !bone) return null

  object.scale.setScalar(1)
  object.position.set(0, kind === 'hat' ? 0.8 : 0, 0)
  object.traverse((child) => {
    if (child.isMesh) child.castShadow = true
  })

  bone.add(object)
  return object
}

/**
 * Applies Bloxity body proportions.
 *
 * Must run every frame: each bone is reset to its rest transform before the
 * multipliers are re-applied, which is what makes the result idempotent and lets
 * proportion changes take effect live.
 *
 * `height`, `armLength`, `headScale` and `neckHeight` are applied exactly as the
 * Bloxity portal does, so the in-game body matches the preview. The remaining three
 * (`shoulderWidth`, `torsoScaleX`, `legOffsetX`) are not implemented in the SDK's
 * preview renderer; they are applied here in the spirit of their names and are the
 * ones to sanity-check against the portal.
 */
export function applyProportions(rig, proportions) {
  const skeleton = rig.skeleton
  if (!skeleton || !proportions) return

  const height = proportions.height ?? 1
  const armLength = proportions.armLength ?? 1
  const headScale = proportions.headScale ?? 1
  const neckHeight = proportions.neckHeight ?? 1
  const shoulderWidth = proportions.shoulderWidth ?? 1
  const torsoScaleX = proportions.torsoScaleX ?? 1
  const legOffsetX = proportions.legOffsetX ?? 1

  // Overall height is a scale on the character root, not on a bone.
  rig.root.scale.set(1, height, 1)

  for (const bone of skeleton.bones) {
    const rest = rig.bones[bone.name]
    if (!rest) continue

    const { origScale, origPos, origQuat } = rest
    bone.position.copy(origPos)
    bone.quaternion.copy(origQuat)
    bone.scale.copy(origScale)

    const name = bone.name

    if (name.startsWith('Arm')) {
      bone.scale.y = origScale.y * armLength
      // Not in the SDK preview: widen the shoulders by pushing the arm roots out.
      if (name === 'ArmL_Offset' || name === 'ArmR_Offset') {
        bone.position.x = origPos.x * shoulderWidth
      }
    } else if (name === NECK_OFFSET_BONE) {
      // Keeps the head sitting on the neck as height/headScale change, then applies
      // neckHeight against the bind-pose offset.
      bone.position.y += (height - headScale) * origPos.y
      bone.position.y += rig.neckOffsetBindY * (neckHeight - 1) * 0.8
    } else if (name === HAT_BONE) {
      // Divided by height so the head stays uniform inside the stretched root.
      bone.scale.set(
        origScale.x * headScale,
        origScale.y * (headScale / height),
        origScale.z * headScale,
      )
    } else if (name === BACK_BONE) {
      // Not in the SDK preview: torso width.
      bone.scale.x = origScale.x * torsoScaleX
    } else if (name === 'LegL_Offset' || name === 'LegR_Offset') {
      // Not in the SDK preview: leg splay, mirrored about the rig centre.
      bone.position.x = origPos.x * legOffsetX
    }
  }
}

/* ---------------------------------------------------------------------------
 * Procedural animation
 *
 * player.glb ships zero animation clips, so a walk/run/jump cycle has to be
 * driven directly on the bones. Rotations are *multiplied onto* whatever
 * applyProportions() just wrote, so this must run immediately after it in the
 * same frame - proportions reset each bone to its rest pose, which is exactly
 * the clean base a pose needs.
 * ------------------------------------------------------------------------- */

const _animQ = new Quaternion()

/**
 * Rotates a bone about one of its precomputed character-space axes.
 * `which` is 'axisX' (forward/back swing) or 'axisZ' (lateral sway).
 */
function rotateBone(rig, name, which, angle) {
  if (!angle) return
  const entry = rig.bones[name]
  const axis = entry?.[which]
  if (!axis) return
  entry.bone.quaternion.multiply(_animQ.setFromAxisAngle(axis, angle))
}

/** Swing a limb forward/back - the plane a walk cycle actually moves in. */
const swing = (rig, name, angle) => rotateBone(rig, name, 'axisX', angle)
/** Sway a limb out to the side. */
const sway = (rig, name, angle) => rotateBone(rig, name, 'axisZ', angle)
/** Turn about the vertical axis (shoulders twisting into a throw). */
const twist = (rig, name, angle) => rotateBone(rig, name, 'axisY', angle)

/**
 * Poses the rig for the current motion state.
 *
 * @param {object} rig from `collectRig`
 * @param {{ time: number, speed: number, grounded: boolean, maxSpeed: number,
 *           velY?: number, throwPhase?: number }} motion
 *   `speed` is horizontal speed in world units/sec; `maxSpeed` is a full-amplitude
 *   run (faster than that only quickens the stride). `velY` is vertical speed.
 *   `throwPhase` runs 0..1 through a boomerang throw (negative = not throwing).
 */
export function animateRig(rig, motion) {
  if (!rig?.skeleton || !motion) return
  poseBase(rig, motion)
  const phase = motion.throwPhase ?? -1
  if (phase >= 0 && phase < 1) poseThrow(rig, phase)
  else if (motion.grounded !== false) poseArm(rig, CARRY, CARRY, 0)
}

/*
 * The right arm always carries a boomerang. Key poses for it, as
 * [upper-arm swing, upper-arm sway, forearm swing, shoulder twist, left-arm reach]
 * (negative swing = forward/up, positive sway = out to the side, positive twist =
 * turn left, negative reach = the left arm reaching forward too).
 */
const CARRY = [-0.3, 0.16, -0.45, 0, 0] // arm by the side, boomerang held upright at the hip
const WIND_UP = [0.3, 1.35, -1.1, -0.75, -0.55] // arm swung out and back, shoulders turned away
const RELEASE = [-1.4, 0.35, -0.12, 0.55, -1.3] // both arms swept forward across the body
/** Sidearm throw timeline (fractions of the throw): wind-up ends, release ends. */
export const THROW_WIND_END = 0.2
export const THROW_RELEASE_END = 0.45

const ease = (t) => t * t * (3 - 2 * t)

function poseArm(rig, a, b, t) {
  const k = ease(Math.min(1, Math.max(0, t)))
  sway(rig, 'ArmR1', a[1] + (b[1] - a[1]) * k)
  swing(rig, 'ArmR1', a[0] + (b[0] - a[0]) * k)
  swing(rig, 'ArmR2', a[2] + (b[2] - a[2]) * k)
  twist(rig, 'Spine1', a[3] + (b[3] - a[3]) * k)
  const reach = a[4] + (b[4] - a[4]) * k
  if (reach) {
    swing(rig, 'ArmL1', reach)
    sway(rig, 'ArmL1', reach * 0.35) // in towards the throwing side
  }
}

/**
 * Sidearm throw layered over the legs: the arm swings out and back while the
 * shoulders turn away, then whips forward across the body to release, and
 * settles back to the carry.
 */
function poseThrow(rig, phase) {
  if (phase < THROW_WIND_END) poseArm(rig, CARRY, WIND_UP, phase / THROW_WIND_END)
  else if (phase < THROW_RELEASE_END) {
    poseArm(rig, WIND_UP, RELEASE, (phase - THROW_WIND_END) / (THROW_RELEASE_END - THROW_WIND_END))
  } else poseArm(rig, RELEASE, CARRY, (phase - THROW_RELEASE_END) / (1 - THROW_RELEASE_END))
}

function poseBase(rig, motion) {
  const { time = 0, speed = 0, grounded = true, maxSpeed = 6, velY = 0 } = motion
  const ratio = Math.min(speed / Math.max(maxSpeed, 0.001), 1)

  rig.root.position.y = rig.rootRestY

  // --- Airborne: one knee driven up, arms out for balance; the legs reach down
  // as the jump turns into a fall ----------------------------------------------
  if (!grounded) {
    const fall = Math.min(1, Math.max(0, -velY / 8))
    swing(rig, 'LegL1', -0.95 + fall * 0.55)
    swing(rig, 'LegL2', 1.25 - fall * 0.7)
    swing(rig, 'LegR1', 0.35 - fall * 0.2)
    swing(rig, 'LegR2', 0.55 - fall * 0.3)
    sway(rig, 'ArmL1', -1.0 - fall * 0.35)
    swing(rig, 'ArmL1', -0.35)
    sway(rig, 'ArmR1', 0.55 + fall * 0.3)
    swing(rig, 'ArmR1', -0.6)
    swing(rig, 'ArmR2', -0.5)
    swing(rig, 'Spine1', -0.12 + fall * 0.1)
    return
  }

  // --- Standing still: relaxed, weight on one leg, breathing (the boomerang
  // arm is posed by animateRig) ---------------------------------------------------
  if (ratio < 0.04) {
    const breath = Math.sin(time * 1.8)
    sway(rig, 'LegL1', -0.06)
    sway(rig, 'LegR1', 0.04)
    sway(rig, 'ArmL1', -0.14 - breath * 0.03)
    swing(rig, 'ArmL2', -0.2)
    swing(rig, 'Spine1', breath * 0.015)
    rig.root.position.y = rig.rootRestY + breath * 0.02
    return
  }

  // --- Walk / run cycle -----------------------------------------------------
  // Step frequency follows the actual speed (level bonuses included) so a fast
  // runner never looks like a moonwalk; the swing amplitude caps at a full run.
  const stride = Math.min(speed / Math.max(maxSpeed, 0.001), 1.7)
  const phase = time * (5 + stride * 5)
  const cycle = Math.sin(phase)
  const legAmp = 0.85 * ratio
  const armAmp = 0.7 * ratio

  // Legs swing in opposition; knees fold on the backswing only.
  swing(rig, 'LegL1', cycle * legAmp)
  swing(rig, 'LegR1', -cycle * legAmp)
  swing(rig, 'LegL2', Math.max(0, -cycle) * 1.1 * ratio)
  swing(rig, 'LegR2', Math.max(0, cycle) * 1.1 * ratio)

  // Arms counter-swing against the legs; the boomerang arm swings less.
  swing(rig, 'ArmL1', -cycle * armAmp)
  swing(rig, 'ArmR1', cycle * armAmp * 0.45)
  swing(rig, 'ArmL2', Math.max(0, cycle) * 0.5 * ratio)

  // Lean into the run, and bob once per step (twice per full cycle).
  swing(rig, 'Spine1', -0.14 * ratio)
  rig.root.position.y = rig.rootRestY + Math.abs(Math.cos(phase)) * 0.18 * ratio
}
