import {afterAll, beforeAll, beforeEach} from 'vitest';
import {
  endPlayback,
  endScene,
  FullSceneDescription,
  PlaybackManager,
  PlaybackStatus,
  startPlayback,
  startScene,
  ThreadGeneratorFactory,
  ValueDispatcher,
  Vector2,
} from '@motion-canvas/core';
import {makeScene2D, Scene2D} from '../../scenes';
import {ReadOnlyTimeEvents} from '@motion-canvas/core/lib/scenes/timeEvents';
import {View2D} from '../View2D';

/**
 * Set up the test environment to support creating nodes.
 *
 * @remarks
 * Should be called inside a `describe()` block.
 * Due to js-dom limitations, layouts are not correctly computed.
 */
export function mockScene2D() {
  const playback = new PlaybackManager();
  const status = new PlaybackStatus(playback);
  const description = {
    ...makeScene2D(function* () {
      // do nothing
    }),
    name: 'test',
    size: new Vector2(1920, 1080),
    resolutionScale: 1,
    timeEventsClass: ReadOnlyTimeEvents,
    playback: status,
  } as unknown as FullSceneDescription<ThreadGeneratorFactory<View2D>>;
  description.onReplaced = new ValueDispatcher(description);
  const scene = new Scene2D(description);

  beforeAll(() => {
    startScene(scene);
    startPlayback(status);
  });
  afterAll(() => {
    endPlayback(status);
    endScene(scene);
  });
  beforeEach(() => scene.reset());
}
