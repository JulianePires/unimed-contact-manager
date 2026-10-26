import { render as baseRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, StrictMode } from 'react';
import { toast } from 'sonner';
import { describe, expect, it } from 'vitest';

import { expectNoAxeViolations } from '@/test/axe';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog';
import { Badge } from './badge';
import { Button } from './button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Label } from './label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Toaster } from './sonner';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

/** Como em main.tsx: StrictMode também exercita a memoização do React Compiler. */
const render = (ui: ReactNode) => baseRender(ui, { wrapper: StrictMode });

const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'ghost',
  'warning-outline',
  'danger',
  'danger-outline',
] as const;
const BADGE_COLORS = ['green', 'violet', 'amber', 'rose', 'zinc'] as const;

describe('componentes base (shadcn/ui adaptado)', () => {
  it('vitrine de botões, badges, formulário e tabela sem violações do axe', async () => {
    const { container } = render(
      <main>
        <h1>Vitrine</h1>
        {BUTTON_VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
        {BADGE_COLORS.map((color) => (
          <Badge key={color} color={color}>
            {color}
          </Badge>
        ))}
        <Badge>padrão</Badge>
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" autoComplete="name" />
        <Table>
          <TableCaption>Contatos</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Maria Silva</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </main>,
    );

    await expectNoAxeViolations(container);
    expect(screen.getByRole('columnheader', { name: 'Nome' })).toHaveAttribute('scope', 'col');
  });

  it('Button é type="button" por padrão e asChild repassa a aparência ao filho', () => {
    render(
      <>
        <Button>Salvar</Button>
        <Button asChild variant="secondary">
          <a href="/contatos">Contatos</a>
        </Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button');
    const link = screen.getByRole('link', { name: 'Contatos' });
    expect(link).not.toHaveAttribute('type');
    expect(link.className).toContain('border-input');
  });

  it('Dialog prende o foco, fecha com Esc e devolve o foco ao gatilho', async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <Button>Abrir</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhes</DialogTitle>
            <DialogDescription>Informações do contato.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Concluir</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Abrir' });

    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Detalhes' });
    expect(within(dialog).getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    await expectNoAxeViolations(dialog);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('AlertDialog foca em Cancelar e só fecha pelas ações', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="danger-outline">Eliminar</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar dados?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction>Eliminar definitivamente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>,
    );

    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar dados?' });

    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
    await expectNoAxeViolations(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('DropdownMenu abre pelo teclado e navega pelos itens', async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost">Conta</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>maria@empresa.com</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Perfil</DropdownMenuItem>
          <DropdownMenuItem variant="danger">Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    screen.getByRole('button', { name: 'Conta' }).focus();
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu');
    await user.keyboard('{ArrowDown}');

    expect(within(menu).getByRole('menuitem', { name: 'Sair' })).toHaveAttribute(
      'data-variant',
      'danger',
    );
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
  });

  it('Select expõe o rótulo e permite escolher pelo teclado', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Label htmlFor="status">Status</Label>
        <Select defaultValue="active">
          <SelectTrigger id="status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </>,
    );
    const trigger = screen.getByRole('combobox', { name: 'Status' });
    expect(trigger).toHaveTextContent('Ativos');

    trigger.focus();
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('option', { name: 'Inativos' }));

    expect(trigger).toHaveTextContent('Inativos');
  });

  it('Dialog também fecha pela ação do rodapé', async () => {
    const user = userEvent.setup();
    render(
      <Dialog defaultOpen>
        <DialogContent closeLabel="Fechar detalhes">
          <DialogTitle>Detalhes</DialogTitle>
          <DialogDescription>Informações do contato.</DialogDescription>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Concluir</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'Fechar detalhes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Toaster exibe as mensagens do toast', async () => {
    render(<Toaster />);

    toast.success('Contato salvo');

    expect(await screen.findByText('Contato salvo')).toBeInTheDocument();
  });
});
