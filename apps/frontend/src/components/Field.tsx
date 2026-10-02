interface FieldProps {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (val: string) => void;
}

export function Field({
  label,
  type,
  placeholder,
  value,
  onChange,
}: FieldProps) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tt-field w-full px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}
