import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';

type NumInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onChange: (event: { target: { value: string } }) => void;
};

// Keeps the typed text locally so the field can be emptied; only valid numbers are committed.
export default function NumInput({ value, onChange, onFocus, onBlur, ...rest }: NumInputProps) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      value={draft}
      onFocus={(event) => { focused.current = true; onFocus?.(event); }}
      onBlur={(event) => { focused.current = false; setDraft(String(value)); onBlur?.(event); }}
      onChange={(event) => {
        setDraft(event.target.value);
        if (event.target.value.trim() !== '' && Number.isFinite(Number(event.target.value))) onChange(event);
      }}
    />
  );
}
