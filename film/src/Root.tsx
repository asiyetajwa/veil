import React from 'react';
import { Composition } from 'remotion';
import { FPS } from './components/Film';
import { veilFilm } from './veil/VeilFilm';

export const Root: React.FC = () => (
  <Composition id="Veil" component={veilFilm.Component} durationInFrames={veilFilm.durationInFrames} fps={FPS} width={1920} height={1080}
    defaultProps={veilFilm.defaultProps} calculateMetadata={veilFilm.calculateMetadata} />
);
