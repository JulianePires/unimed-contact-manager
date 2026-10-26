import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { announce } from '@/lib/a11y/announce';

import { LiveAnnouncer } from './live-announcer';

describe('LiveAnnouncer', () => {
  it('expõe regiões polite e assertive atômicas', () => {
    render(<LiveAnnouncer />);

    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
    for (const region of [screen.getByRole('status'), screen.getByRole('alert')]) {
      expect(region).toHaveAttribute('aria-atomic', 'true');
    }
  });

  it('anuncia na região educada por padrão', () => {
    render(<LiveAnnouncer />);

    act(() => {
      announce('12 contatos encontrados');
    });

    expect(screen.getByRole('status')).toHaveTextContent('12 contatos encontrados');
  });

  it('anuncia erros na região assertiva sem apagar a educada', () => {
    render(<LiveAnnouncer />);
    act(() => {
      announce('Importação concluída');
      announce('Não foi possível salvar', 'assertive');
    });

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar');
    expect(screen.getByRole('status')).toHaveTextContent('Importação concluída');
  });

  it('troca o nó ao repetir a mesma mensagem para que seja lida de novo', () => {
    render(<LiveAnnouncer />);
    act(() => {
      announce('Contato salvo');
    });
    const first = screen.getByText('Contato salvo');

    act(() => {
      announce('Contato salvo');
    });

    expect(screen.getByText('Contato salvo')).not.toBe(first);
  });
});
