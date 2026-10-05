import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ActorVisibility } from '../src/game/actor-visibility.js';

function fixture(shared = false) {
  const scene = new THREE.Scene(),
    avatar = new THREE.Group(),
    drawing = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.8, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xff8844 }),
    ),
    actor = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ color: 0x6688aa }),
    body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), material),
    wall = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 0.2), shared ? material : material.clone()),
    camera = new THREE.PerspectiveCamera(),
    visibility = new ActorVisibility();
  drawing.position.y = 1;
  avatar.add(drawing);
  body.position.y = 1.7;
  actor.position.z = 2;
  actor.add(body);
  wall.position.set(8, 2, 2);
  scene.add(avatar, actor, wall);
  camera.position.set(0, 3, 8);
  visibility.setCharacter(avatar);
  visibility.setActors([actor], scene);
  return { scene, avatar, drawing, actor, body, wall, camera, visibility, material };
}
function fade(f) {
  f.visibility.update(f.camera, 0.1);
  f.visibility.update(f.camera, 0.1);
}

test('only close actor geometry in front of the animated drawing fades and depth stays enabled', () => {
  const f = fixture(),
    childCount = f.scene.children.length,
    geometry = f.body.geometry;
  fade(f);
  assert.ok(f.body.material.opacity < 0.4);
  assert.equal(f.body.material.alphaHash, true);
  assert.equal(f.body.material.transparent, false);
  assert.equal(f.body.material.depthTest, true);
  assert.equal(f.body.material.depthWrite, true);
  assert.equal(f.wall.material.opacity, 1);
  assert.equal(f.wall.material.alphaHash, false);
  assert.equal(f.scene.children.length, childCount);
  assert.equal(f.body.geometry, geometry);
  // The ray goes through the actor's bounding box corner but misses the sphere.
  f.actor.position.x = 0.8;
  f.body.position.y = 2.65;
  for (let i = 0; i < 10; i++) f.visibility.update(f.camera, 0.1);
  assert.equal(f.body.material.opacity, 1);
  f.visibility.dispose();
});

test('far, behind and invisible actors stay opaque and leaving close combat restores opacity', () => {
  const f = fixture();
  fade(f);
  assert.ok(f.body.material.opacity < 0.4);
  for (const position of [
    [0, 0, -2],
    [0, 0, 7],
    [4, 0, 2],
  ]) {
    f.actor.position.set(...position);
    for (let i = 0; i < 10; i++) f.visibility.update(f.camera, 0.1);
    assert.equal(f.body.material.opacity, 1, JSON.stringify(position));
  }
  f.actor.position.set(0, 0, 2);
  f.actor.visible = false;
  fade(f);
  assert.equal(f.body.material.opacity, 1);
  f.visibility.dispose();
});

test('samples follow free drawing pieces through animation and character replacement', () => {
  const f = fixture();
  fade(f);
  assert.ok(f.body.material.opacity < 0.4);
  // Move only the piece, like a sketch rig's attack pose, not the avatar root.
  f.drawing.position.x = 4;
  for (let i = 0; i < 10; i++) f.visibility.update(f.camera, 0.1);
  assert.equal(f.body.material.opacity, 1);
  const replacement = new THREE.Group(),
    wing = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 0.1), f.drawing.material);
  wing.position.y = 1;
  replacement.add(wing);
  f.scene.add(replacement);
  f.visibility.setCharacter(replacement);
  fade(f);
  assert.ok(f.body.material.opacity < 0.4);
  assert.equal(f.visibility.samples.length, 1);
  assert.equal(f.visibility.samples[0].mesh, wing);
  f.visibility.dispose();
});

test('shared wall materials are isolated and stage changes dispose only the owned material', () => {
  const f = fixture(true),
    clone = f.body.material;
  let materialDisposes = 0,
    geometryDisposes = 0,
    originalDisposes = 0;
  clone.addEventListener('dispose', () => materialDisposes++);
  f.body.geometry.addEventListener('dispose', () => geometryDisposes++);
  f.material.addEventListener('dispose', () => originalDisposes++);
  assert.notEqual(clone, f.material);
  fade(f);
  assert.ok(clone.opacity < 0.4);
  assert.equal(f.wall.material.opacity, 1);
  assert.equal(f.wall.material.alphaHash, false);
  f.visibility.setActors([], f.scene);
  assert.equal(f.body.material, f.material);
  assert.equal(materialDisposes, 1);
  assert.equal(originalDisposes, 0);
  assert.equal(geometryDisposes, 0);
  f.visibility.dispose();
  assert.equal(materialDisposes, 1);
});

test('clearing a stage restores borrowed material settings and does not dispose its geometry', () => {
  const f = fixture();
  let disposes = 0;
  f.body.geometry.addEventListener('dispose', () => disposes++);
  fade(f);
  f.visibility.clearActors();
  assert.equal(f.body.material.opacity, 1);
  assert.equal(f.body.material.alphaHash, false);
  assert.equal(disposes, 0);
  assert.equal(f.visibility.actors.length, 0);
  // Preview rendering adds no visibility meshes and retains the same avatar.
  const meshes = [];
  f.scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  assert.equal(meshes.length, 3);
  f.visibility.dispose();
  assert.equal(f.visibility.avatar, null);
});
