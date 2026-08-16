import RHFPhoneInput, { type Value as E164Value } from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import fr from 'react-phone-number-input/locale/fr.json';
import 'react-phone-number-input/style.css';
import './PhoneInput.css';

export interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  /** Pays par défaut si la valeur ne contient pas encore d'indicatif. Sénégal par défaut : la majorité des contacts restent locaux. */
  defaultCountry?: string;
}

/**
 * Champ téléphone international (indicatif + format adapté au pays choisi).
 * La valeur est toujours stockée/transmise au format E.164 (ex. +221771234567),
 * quel que soit le pays — le formatage local n'est qu'un affichage.
 */
export function PhoneInput({
  label = 'Téléphone',
  value,
  onChange,
  placeholder = '77 123 45 67',
  disabled = false,
  required = false,
  helperText,
  defaultCountry = 'SN',
}: PhoneInputProps) {
  return (
    <label className="block">
      <span className="text-[0.78rem] font-semibold text-slate-600 sm:text-[0.64rem] sm:font-medium">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      <div className="sk-phone-input mt-0.5">
        <RHFPhoneInput
          international
          withCountryCallingCode
          flags={flags}
          labels={fr}
          defaultCountry={defaultCountry as never}
          value={(value || undefined) as E164Value | undefined}
          onChange={(next) => onChange(next ?? '')}
          placeholder={placeholder}
          disabled={disabled}
          numberInputProps={{
            className: 'sk-phone-input-field',
            inputMode: 'tel',
          }}
        />
      </div>
      {helperText && <p className="mt-1 text-[0.66rem] text-slate-500 sm:text-[10px]">{helperText}</p>}
    </label>
  );
}
