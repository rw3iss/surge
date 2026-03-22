import { Component, createSignal, Show, onCleanup } from 'solid-js';
import './ColorPicker.scss';

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  showHexInput?: boolean;
  defaultColor?: string;
}

const PRESET_COLORS = [
  '#ffffff', '#000000', '#e63946', '#1d3557', '#f1faee', '#457b9d',
  '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#264653', '#6b705c',
  '#fefae0', '#dda15e', '#bc6c25', '#606c38', '#283618', '#a8dadc',
  '#ff006e', '#8338ec',
];

function isValidHex(hex: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}

export default function ColorPicker(props: ColorPickerProps) {
  const defaultColor = props.defaultColor || '#ffffff';
  const [open, setOpen] = createSignal(false);
  const [hexInput, setHexInput] = createSignal(props.value || defaultColor);
  let containerRef: HTMLDivElement | undefined;

  const currentColor = () => isValidHex(props.value) ? props.value : defaultColor;

  const handleHexChange = (val: string) => {
    // Auto-add # prefix
    if (val && !val.startsWith('#')) val = '#' + val;
    setHexInput(val);
    if (isValidHex(val)) {
      props.onChange(val);
    }
  };

  const selectPreset = (color: string) => {
    setHexInput(color);
    props.onChange(color);
    setOpen(false);
  };

  // Close on outside click
  const handleClickOutside = (e: MouseEvent) => {
    if (containerRef && !containerRef.contains(e.target as Node)) {
      setOpen(false);
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('mousedown', handleClickOutside);
    onCleanup(() => document.removeEventListener('mousedown', handleClickOutside));
  }

  return (
    <div class="color-picker" ref={containerRef}>
      <Show when={props.showHexInput !== false}>
        <input
          type="text"
          class={`color-picker__hex-input ${!isValidHex(hexInput()) ? 'color-picker__hex-input--invalid' : ''}`}
          value={hexInput()}
          onInput={(e) => handleHexChange(e.currentTarget.value)}
          placeholder="#ffffff"
          maxLength={7}
        />
      </Show>
      <button
        type="button"
        class="color-picker__swatch"
        style={{ background: currentColor() }}
        onClick={() => setOpen(!open())}
        title="Pick color"
      />
      <Show when={open()}>
        <div class="color-picker__popup">
          <div class="color-picker__presets">
            {PRESET_COLORS.map((color) => (
              <button
                type="button"
                class={`color-picker__preset ${color === currentColor() ? 'color-picker__preset--active' : ''}`}
                style={{ background: color }}
                onClick={() => selectPreset(color)}
                title={color}
              />
            ))}
          </div>
          <div class="color-picker__custom">
            <label>Custom:</label>
            <input
              type="text"
              value={hexInput()}
              onInput={(e) => handleHexChange(e.currentTarget.value)}
              placeholder="#000000"
              maxLength={7}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
