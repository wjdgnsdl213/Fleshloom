/**
 * The static half of the 3D scene: ground, weather volume, lights, and every
 * authored street structure given real geometry.
 *
 * The structures are built from the same footprints the simulation collides
 * against (`PROP_FOOTPRINTS`, `DISTRICT_BLOCKS`), so what the player sees and
 * what stops them are the same boxes. Heights are presentation-only.
 */

import {
  BoxGeometry,
  CircleGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  PointLight,
  Scene,
  type BufferGeometry,
} from 'three';
import type { WorldBounds } from '../../config/world';
import {
  DISTRICT_BLOCKS,
  DISTRICT_LIGHTS,
  DISTRICT_PUDDLES,
  DISTRICT_PROPS,
  type DistrictPropKind,
} from '../../content/quarantineDistrict';
import { PROP_FOOTPRINTS } from '../../content/quarantineColliders';
import { SCENE_SHADOW_DIRECTION } from '../GroundedLighting';
import { SCENE_PALETTE, SHARED_MATERIALS } from './materials';

/** Presentation-only heights, in world units, per structure kind. */
export const PROP_HEIGHTS: Readonly<Record<DistrictPropKind, number>> =
  Object.freeze({
    'response-van': 188,
    'bio-barrier': 150,
    floodlight: 340,
    'collapsed-shelter': 132,
  });

const SHADOW_MAP_SIZE = 2_048;

/**
 * Quarantine lamp budget. The district authors far more lamps than a forward
 * renderer can light in one pass, so a fixed pool is moved to whichever are
 * nearest rather than one light created per authored lamp.
 */
const LAMP_BUDGET = 6;
const LAMP_CULL_RADIUS = 900;
const LAMP_HEIGHT = 150;
const LAMP_COLOR = 0xffc27a;
/**
 * With decay 2 the illuminance a lamp delivers is intensity / distance², and
 * the distances here are in world units of tens to hundreds. A lamp should
 * lay down about half the key light's contribution at 150 units, which is
 * this — not the six-figure number that reads plausible for metres.
 */
const LAMP_INTENSITY = 11_000;
const LAMP_DECAY = 2;

/** Ground clearance for flat decals, so they never z-fight the road. */
const DECAL_LIFT = 0.6;

export class WorldStage {
  public readonly scene = new Scene();
  public readonly keyLight = new DirectionalLight(0xbcd2dc, 2.6);

  private readonly structures = new Group();
  private readonly decals = new Group();
  private readonly lamps = new Group();
  private readonly lampLights: PointLight[] = [];
  private readonly geometries: BufferGeometry[] = [];

  public constructor(bounds: WorldBounds) {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxY - bounds.minY;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minY + bounds.maxY) / 2;

    this.scene.background = new Color(SCENE_PALETTE.void);
    // Deliberately no distance fog. Under an orthographic camera, distance to
    // the eye varies with screen row rather than with depth into the scene, so
    // three's Fog draws a horizontal band across the middle of the viewport
    // instead of thickening air. Night depth comes from the lighting falloff.

    const groundGeometry = this.own(new PlaneGeometry(width, depth));
    const ground = new Mesh(groundGeometry, SHARED_MATERIALS.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(centerX, 0, centerZ);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.scene.add(new HemisphereLight(0x3d5460, 0x101416, 1.15));

    // The key light keeps the shadow direction the 2D grounding pass already
    // established, so both backends throw shadows the same way.
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.keyLight.shadow.bias = -0.0007;
    this.keyLight.shadow.normalBias = 1.4;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);

    this.buildDecals();
    this.buildStructures();
    this.buildLamps();
    this.scene.add(this.decals);
    this.scene.add(this.structures);
    this.scene.add(this.lamps);
  }

  /**
   * Lights the nearest few quarantine lamps and leaves the rest dark. The
   * district authors far more lamps than a forward renderer can afford in one
   * pass, and the ones off screen contribute nothing but shader cost.
   */
  public focusLights(centerX: number, centerZ: number): void {
    const ranked = DISTRICT_LIGHTS.map((light, index) => ({
      index,
      light,
      distance: Math.hypot(
        light.position.x - centerX,
        light.position.y - centerZ,
      ),
    })).sort((a, b) => a.distance - b.distance);

    this.lampLights.forEach((lamp, slot) => {
      const nearest = ranked[slot];
      if (nearest === undefined || nearest.distance > LAMP_CULL_RADIUS) {
        lamp.visible = false;
        return;
      }
      lamp.visible = true;
      lamp.position.set(
        nearest.light.position.x,
        LAMP_HEIGHT,
        nearest.light.position.y,
      );
    });
  }

  /**
   * Keeps the shadow frustum tight around whatever the camera can currently
   * see; a district-wide frustum would spend the whole 2048 map on ground the
   * player never looks at.
   */
  public focusShadows(
    centerX: number,
    centerZ: number,
    halfWidth: number,
    halfDepth: number,
  ): void {
    const reach = Math.max(halfWidth, halfDepth) * 1.35;
    const light = this.keyLight;

    light.target.position.set(centerX, 0, centerZ);
    light.target.updateMatrixWorld();
    light.position.set(
      centerX - SCENE_SHADOW_DIRECTION.x * reach * 1.2,
      reach * 1.5,
      centerZ - SCENE_SHADOW_DIRECTION.y * reach * 1.2,
    );

    const shadowCamera = light.shadow.camera;
    shadowCamera.left = -reach;
    shadowCamera.right = reach;
    shadowCamera.top = reach;
    shadowCamera.bottom = -reach;
    shadowCamera.near = 1;
    shadowCamera.far = reach * 4;
    shadowCamera.updateProjectionMatrix();
  }

  public dispose(): void {
    for (const geometry of this.geometries) {
      geometry.dispose();
    }
    this.geometries.length = 0;
  }

  private own<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private buildLamps(): void {
    for (let slot = 0; slot < LAMP_BUDGET; slot += 1) {
      // No shadow map on these: one shadow-casting key light is the budget,
      // and a lamp that also casts would cost a cube render per frame.
      const lamp = new PointLight(
        LAMP_COLOR,
        LAMP_INTENSITY,
        LAMP_CULL_RADIUS,
        LAMP_DECAY,
      );
      lamp.visible = false;
      this.lampLights.push(lamp);
      this.lamps.add(lamp);
    }
  }

  private buildDecals(): void {
    for (const puddle of DISTRICT_PUDDLES) {
      const geometry = this.own(new CircleGeometry(1, 28));
      const mesh = new Mesh(geometry, SHARED_MATERIALS.puddle);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = -puddle.rotation;
      mesh.scale.set(puddle.radiusX, puddle.radiusY, 1);
      mesh.position.set(puddle.position.x, DECAL_LIFT, puddle.position.y);
      mesh.receiveShadow = true;
      this.decals.add(mesh);
    }
  }

  private buildStructures(): void {
    for (const block of DISTRICT_BLOCKS) {
      this.addBox(
        block.position.x,
        block.position.y,
        block.length,
        block.height,
        block.width,
        block.rotation,
        SHARED_MATERIALS.concrete,
      );
    }

    for (const prop of DISTRICT_PROPS) {
      const footprint = PROP_FOOTPRINTS[prop.kind];
      const length = footprint.length * prop.scale;
      const width = footprint.width * prop.scale;
      const height = PROP_HEIGHTS[prop.kind] * prop.scale;
      const rotation = footprint.rotation;
      const x = prop.position.x;
      const z = prop.position.y;

      switch (prop.kind) {
        case 'floodlight': {
          // A mast rather than a solid block: the collider is only the base.
          const mastWidth = width * 0.28;
          this.addBox(
            x,
            z,
            mastWidth,
            height,
            mastWidth,
            rotation,
            SHARED_MATERIALS.steel,
            height / 2,
          );
          this.addBox(
            x,
            z,
            width * 1.5,
            height * 0.16,
            width * 0.9,
            rotation,
            SHARED_MATERIALS.lamp,
            height,
          );
          break;
        }
        case 'response-van': {
          const bodyHeight = height * 0.62;
          this.addBox(
            x,
            z,
            length,
            bodyHeight,
            width,
            rotation,
            SHARED_MATERIALS.steel,
            bodyHeight / 2,
          );
          this.addBox(
            x,
            z,
            length * 0.58,
            height - bodyHeight,
            width * 0.94,
            rotation,
            SHARED_MATERIALS.steel,
            bodyHeight + (height - bodyHeight) / 2,
          );
          break;
        }
        case 'collapsed-shelter': {
          // Leaned slab: the tilt is what sells it as fallen rather than built.
          this.addBox(
            x,
            z,
            length,
            height,
            width,
            rotation,
            SHARED_MATERIALS.concreteDark,
            height / 2,
            0.22,
          );
          break;
        }
        default: {
          this.addBox(
            x,
            z,
            length,
            height,
            width,
            rotation,
            SHARED_MATERIALS.concrete,
          );
          break;
        }
      }
    }
  }

  private addBox(
    x: number,
    z: number,
    length: number,
    height: number,
    width: number,
    rotation: number,
    material: Mesh['material'],
    elevation = height / 2,
    tilt = 0,
  ): void {
    const geometry = this.own(new BoxGeometry(length, height, width));
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, elevation, z);
    mesh.rotation.y = -rotation;
    if (tilt !== 0) {
      mesh.rotation.z = tilt;
    }
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.structures.add(mesh);
  }
}
