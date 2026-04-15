interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (v: T) => void;
}

export const ChipGroup = <T extends string>({ options, value, onChange }: Props<T>) => (
  <div className="chip-group">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        className={'chip' + (value === o.value ? ' active' : '')}
        onClick={() => onChange(o.value)}
      >{o.label}</button>
    ))}
  </div>
);
