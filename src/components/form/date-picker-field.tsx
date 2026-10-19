import * as React from "react";
import { format, getDaysInMonth, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CalendarYearPicker } from "@/components/ui/calendar-year-picker";
import { Input } from "@/components/ui/input";
import { FormFieldShell } from "./form-field-shell";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: FieldPath<TFieldValues>;
  id: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  startYear?: number;
  endYear?: number;
}

export function DatePickerField<TFieldValues extends FieldValues>({
  control,
  name,
  id,
  label,
  placeholder = "DD/MM/YYYY",
  required = false,
  className,
  startYear = 1900,
  endYear = new Date().getFullYear(),
}: DatePickerFieldProps<TFieldValues>) {
  const [open, setOpen] = React.useState(false);

  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: required ? `${label} is required.` : false,
        validate: (value) =>
          !value ||
          Boolean(parseDate(String(value))) ||
          "Enter a valid date (DD/MM/YYYY).",
      }}
      render={({ field, fieldState }) => {
        const value = String(field.value ?? "");
        const selectedDate = parseDate(value);

        return (
          <FormFieldShell
            id={id}
            label={label}
            required={required}
            invalid={fieldState.invalid}
            error={fieldState.error}
            className={className}
          >
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverAnchor asChild>
                <div className="relative">
                  <Input
                    {...field}
                    id={id}
                    type="text"
                    value={
                      selectedDate && value.includes("-")
                        ? format(selectedDate, "dd/MM/yyyy")
                        : value
                    }
                    placeholder={placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    aria-required={required}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      fieldState.error ? `${id}-error` : undefined
                    }
                    className="pl-11"
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      if (isDateDraft(nextValue)) {
                        field.onChange(nextValue);
                      }
                    }}
                    onBlur={() => {
                      if (selectedDate) {
                        field.onChange(format(selectedDate, "dd/MM/yyyy"));
                      }
                      field.onBlur();
                    }}
                  />
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Choose ${label.toLowerCase()}`}
                      title={`Choose ${label.toLowerCase()}`}
                      className="absolute inset-y-0 left-0 h-auto w-11 rounded-r-none text-muted-foreground"
                    >
                      <CalendarIcon className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                </div>
              </PopoverAnchor>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  defaultMonth={selectedDate}
                  captionLayout="dropdown"
                  reverseYears
                  components={{ YearsDropdown: CalendarYearPicker }}
                  classNames={{
                    month_caption:
                      "flex min-h-11 items-center justify-center px-8",
                    dropdowns:
                      "flex min-h-11 items-center justify-center gap-2 text-sm font-medium",
                    nav: "pointer-events-none absolute inset-x-0 top-0 flex min-h-11 items-center justify-between gap-1 *:pointer-events-auto",
                    caption_label:
                      "flex h-11 items-center gap-2 px-3 text-sm font-medium sm:h-9 sm:pointer-coarse:h-11 [&>svg]:size-4",
                  }}
                  startMonth={new Date(startYear, 0)}
                  endMonth={new Date(endYear, 11)}
                  onSelect={(date) => {
                    field.onChange(date ? format(date, "dd/MM/yyyy") : "");
                    setOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </FormFieldShell>
        );
      }}
    />
  );
}

function isDateDraft(value: string) {
  if (!/^\d{0,2}(?:\/\d{0,2}(?:\/\d{0,4})?)?$/.test(value)) {
    return false;
  }

  const [day = "", month = "", year = ""] = value.split("/");
  if (
    day === "00" ||
    month === "00" ||
    Number(day) > 31 ||
    Number(month) > 12
  ) {
    return false;
  }

  if (Number(day) > 0 && Number(month) > 0) {
    // Allow February 29 while the year is still being entered.
    const draftYear = year.length === 4 ? Number(year) : 2000;
    const daysInMonth = getDaysInMonth(
      new Date(draftYear, Number(month) - 1, 1),
    );
    if (Number(day) > daysInMonth) return false;
    if (year.length === 4) return Boolean(parseDate(value));
  }

  return true;
}

function parseDate(value: string) {
  const trimmedValue = value.trim();
  if (!/^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})$/.test(trimmedValue)) {
    return undefined;
  }
  const dateFormat = trimmedValue.includes("-") ? "yyyy-MM-dd" : "d/M/yyyy";
  const date = parse(trimmedValue, dateFormat, new Date());
  return isValid(date) ? date : undefined;
}
