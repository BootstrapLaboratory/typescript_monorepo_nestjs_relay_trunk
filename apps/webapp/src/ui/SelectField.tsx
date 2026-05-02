import * as Select from "@radix-ui/react-select";
import { cx } from "./classNames";
import * as styles from "./SelectField.css";

export type SelectFieldOption<Value extends string> = {
  value: Value;
  label: string;
};

type SelectFieldProps<Value extends string> = {
  value: Value;
  options: ReadonlyArray<SelectFieldOption<Value>>;
  onValueChange: (value: Value) => void;
  ariaLabel: string;
  className?: string;
};

export function SelectField<Value extends string>({
  ariaLabel,
  className,
  onValueChange,
  options,
  value,
}: SelectFieldProps<Value>) {
  return (
    <Select.Root
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as Value)}
    >
      <Select.Trigger
        className={cx(styles.trigger, className)}
        aria-label={ariaLabel}
      >
        <Select.Value />
        <Select.Icon className={styles.icon} aria-hidden>
          v
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={styles.content}
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport className={styles.viewport}>
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className={styles.item}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
