import React from 'react';
import { AbsoluteFill } from 'remotion';
import { createFilm } from '../components/Film';
import { theme } from '../theme';
import { SCENES } from './script';
import { CanaryScene, CloseScene, CloudScene, GateScene, HookScene, MasksScene, ReceiptScene, TitleScene } from './scenes';

// A neutral mid canvas behind the dissolves, so cuts between pale and black scenes never flash.
const Canvas: React.FC = () => <AbsoluteFill style={{ background: theme.night }} />;

export const veilFilm = createFilm('veil', SCENES, {
  hook: HookScene,
  title: TitleScene,
  masks: MasksScene,
  gate: GateScene,
  cloud: CloudScene,
  canary: CanaryScene,
  receipt: ReceiptScene,
  close: CloseScene,
}, Canvas);
