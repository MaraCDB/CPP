import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ContactMenu } from '../../src/components/common/ContactMenu';

describe('ContactMenu', () => {
  it('mostra WhatsApp e Chiama sempre', () => {
    render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.getByText(/WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText(/Chiama/i)).toBeInTheDocument();
  });

  it('mostra Email solo se contattoEmail è presente', () => {
    const { rerender } = render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.queryByText(/Email/i)).not.toBeInTheDocument();

    rerender(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" email="x@y.it" />);
    expect(screen.getByText(/Email/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Email/i })).toHaveAttribute('href', 'mailto:x@y.it');
  });

  it('link WhatsApp usa E.164 senza +', () => {
    render(<ContactMenu phoneE164="+393351234567" label="+39 335 1234567" />);
    fireEvent.click(screen.getByRole('button', { name: /\+39 335 1234567/ }));
    expect(screen.getByRole('link', { name: /WhatsApp/i })).toHaveAttribute('href', 'https://wa.me/393351234567');
  });

  it('mostra Apri in Gmail solo se resourceName è presente', () => {
    render(<ContactMenu phoneE164="+393351234567" label="X" resourceName="people/c1" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/Apri in Gmail/i)).toBeInTheDocument();
  });
});
