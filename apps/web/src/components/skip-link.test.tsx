import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SkipLink } from './skip-link';

describe('SkipLink', () => {
  it('aponta para o alvo informado e acompanha a troca de alvo', () => {
    const { rerender } = render(<SkipLink targetId="conteudo" />);
    const link = screen.getByRole('link', { name: 'Pular para o conteúdo' });
    expect(link).toHaveAttribute('href', '#conteudo');

    rerender(<SkipLink targetId="conteudo" />);
    expect(link).toHaveAttribute('href', '#conteudo');

    rerender(<SkipLink targetId="lista" />);
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute(
      'href',
      '#lista',
    );
  });
});
