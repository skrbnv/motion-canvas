import type {Project} from '@motion-canvas/core';

import styles from './styles.scss?inline';
import html from './template.html?raw';

const TEMPLATE = `<style>${styles}</style>${html}`;
const ID = 'motion-canvas-player';

enum State {
  Initial = 'initial',
  Loading = 'loading',
  Ready = 'ready',
  Error = 'error',
}

class MotionCanvasPlayer extends HTMLElement {
  public static get observedAttributes() {
    return ['src', 'quality', 'width', 'height', 'auto'];
  }

  private get auto() {
    const attr = this.getAttribute('auto');
    return !!attr;
  }

  private get quality() {
    const attr = this.getAttribute('quality');
    return attr ? parseFloat(attr) : 1;
  }

  private get width() {
    const attr = this.getAttribute('width');
    return attr ? parseFloat(attr) : this.defaultWidth;
  }

  private get height() {
    const attr = this.getAttribute('height');
    return attr ? parseFloat(attr) : this.defaultHeight;
  }

  private readonly root: ShadowRoot;
  private readonly canvas: HTMLCanvasElement;
  private readonly overlay: HTMLCanvasElement;
  private readonly button: HTMLDivElement;

  private state = State.Initial;
  private defaultWidth = 1920;
  private defaultHeight = 1080;
  private project: Project | null = null;
  private abortController: AbortController | null = null;
  private runId: number | null = null;
  private mouseMoveId: number | null = null;
  private renderTime = 0;
  private finished = false;
  private playing = false;

  public constructor() {
    super();
    this.root = this.attachShadow({mode: 'open'});
    this.root.innerHTML = TEMPLATE;
    this.canvas = this.root.querySelector('.canvas');
    this.overlay = this.root.querySelector('.overlay');
    this.button = this.root.querySelector('.button');

    this.overlay.addEventListener('click', this.handleClick);
    this.overlay.addEventListener('mousemove', this.handleMouseMove);
    this.overlay.addEventListener('mouseleave', this.handleMouseLeave);
    this.setState(State.Initial);
  }

  private handleMouseMove = () => {
    if (this.mouseMoveId) {
      clearTimeout(this.mouseMoveId);
    }
    this.mouseMoveId = window.setTimeout(() => {
      this.mouseMoveId = null;
      this.updateClass();
    }, 2000);
    this.updateClass();
  };

  private handleMouseLeave = () => {
    if (this.mouseMoveId) {
      clearTimeout(this.mouseMoveId);
      this.mouseMoveId = null;
      this.updateClass();
    }
  };

  private handleClick = () => {
    this.handleMouseMove();
    this.setPlaying(!this.playing);
    this.button.animate(
      [
        {scale: `0.9`},
        {
          scale: `1`,
          easing: 'ease-out',
        },
      ],
      {duration: 200},
    );
  };

  private setState(state: State) {
    this.state = state;
    this.setPlaying(this.playing);
  }

  private setPlaying(value: boolean) {
    if (this.state === State.Ready && (value || this.auto)) {
      this.playing = true;
      this.request();
    } else {
      this.playing = false;
    }
    this.updateClass();
  }

  private updateClass() {
    this.overlay.className = `overlay state-${this.state}`;
    this.overlay.classList.toggle('playing', this.playing);
    this.overlay.classList.toggle('auto', this.auto);
    this.overlay.classList.toggle(
      'hover',
      this.mouseMoveId !== null && !this.auto,
    );
  }

  private shouldPlay() {
    return this.state === State.Ready && this.playing;
  }

  private async updateSource(source: string) {
    this.setState(State.Loading);

    this.abortController?.abort();
    this.abortController = new AbortController();

    let project: Project;
    try {
      project = (
        await import(/* webpackIgnore: true */ /* @vite-ignore */ source)
      ).default;
    } catch (e) {
      this.setState(State.Error);
      return;
    }

    if (this.abortController.signal.aborted) return;
    project.framerate = 60;
    await project.recalculate();

    if (this.abortController.signal.aborted) return;
    await project.seek(0);

    if (this.abortController.signal.aborted) return;
    const size = project.getSize();
    this.defaultWidth = size.width;
    this.defaultHeight = size.height;
    this.finished = false;
    this.project = project;
    this.project.resolutionScale = this.quality;
    this.project.setSize(this.width, this.height);
    this.project.logger.onLogged.subscribe(console.log);
    this.project.setCanvas(this.canvas);

    this.setState(State.Ready);
  }

  private async run() {
    if (this.finished) {
      await this.project.seek(0);
    }

    if (!this.shouldPlay()) return;
    this.finished = await this.project.next();

    if (!this.shouldPlay()) return;
    await this.project.render();
  }

  private request() {
    this.runId ??= requestAnimationFrame(async time => {
      this.runId = null;
      if (time - this.renderTime >= 990 / this.project.framerate) {
        this.renderTime = time;
        if (!this.shouldPlay()) return;

        try {
          await this.run();
        } catch (e) {
          this.setState(State.Error);
          return;
        }
      }

      this.request();
    });
  }

  private attributeChangedCallback(name: string, oldValue: any, newValue: any) {
    switch (name) {
      case 'auto':
        this.setPlaying(true);
        break;
      case 'src':
        this.updateSource(newValue);
        break;
      case 'quality':
        if (this.project) {
          this.project.resolutionScale = this.quality;
        }
        break;
      case 'width':
      case 'height':
        if (this.project) {
          this.project.setSize(this.width, this.height);
        }
        break;
    }
  }

  private disconnectedCallback() {
    if (this.playing) {
      this.setPlaying(false);
    }
  }
}

if (!customElements.get(ID)) {
  customElements.define(ID, MotionCanvasPlayer);
}
