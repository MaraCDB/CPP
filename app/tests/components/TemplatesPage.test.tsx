import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplatesPage } from '../../src/components/settings/TemplatesPage';
import { useTemplates } from '../../src/store/templates';
import { DEFAULT_TEMPLATES } from '../../src/lib/reminders/templates';

beforeEach(() => {
  useTemplates.setState({ items: [...DEFAULT_TEMPLATES] });
});

describe('TemplatesPage', () => {
  it('renders all templates sorted by sortOrder', () => {
    render(<TemplatesPage onBack={() => {}} />);
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(DEFAULT_TEMPLATES.length);
  });

  it('calls onBack when back button is clicked', () => {
    let called = false;
    render(<TemplatesPage onBack={() => { called = true; }} />);
    fireEvent.click(screen.getByText('← Indietro'));
    expect(called).toBe(true);
  });

  it('opens edit modal when pencil button is clicked', () => {
    render(<TemplatesPage onBack={() => {}} />);
    const editButtons = screen.getAllByText('✏️');
    fireEvent.click(editButtons[0]);
    expect(screen.getByText('Modifica template')).toBeTruthy();
  });

  it('closes modal on Annulla', () => {
    render(<TemplatesPage onBack={() => {}} />);
    fireEvent.click(screen.getAllByText('✏️')[0]);
    expect(screen.getByText('Modifica template')).toBeTruthy();
    fireEvent.click(screen.getByText('Annulla'));
    expect(screen.queryByText('Modifica template')).toBeNull();
  });

  it('opens new-template modal with empty title on "+ Nuovo template"', () => {
    render(<TemplatesPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('+ Nuovo template'));
    expect(screen.getByText('Modifica template')).toBeTruthy();
    const titleInput = screen.getByDisplayValue('');
    expect(titleInput).toBeTruthy();
  });

  it('Salva button is disabled when title is empty', () => {
    render(<TemplatesPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('+ Nuovo template'));
    const salva = screen.getByText('Salva');
    expect((salva as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves a new custom template when title is filled and Salva clicked', () => {
    render(<TemplatesPage onBack={() => {}} />);
    fireEvent.click(screen.getByText('+ Nuovo template'));
    const titleInput = screen.getByDisplayValue('') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Nuovo test' } });
    fireEvent.click(screen.getByText('Salva'));
    expect(screen.queryByText('Modifica template')).toBeNull();
    const items = useTemplates.getState().items;
    expect(items.some(t => t.title === 'Nuovo test')).toBe(true);
  });

  it('toggleEnabled is called when checkbox is changed', () => {
    render(<TemplatesPage onBack={() => {}} />);
    const firstTemplate = [...DEFAULT_TEMPLATES].sort((a, b) => a.sortOrder - b.sortOrder)[0];
    const checkbox = screen.getByLabelText(`Abilita ${firstTemplate.title}`) as HTMLInputElement;
    const before = firstTemplate.enabled;
    fireEvent.click(checkbox);
    const updated = useTemplates.getState().items.find(t => t.id === firstTemplate.id);
    expect(updated?.enabled).toBe(!before);
  });
});
