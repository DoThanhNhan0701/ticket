import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWatch, type UseFormReturn } from "react-hook-form";
import {
  listVietnamProvinces,
  listVietnamWards,
} from "../api/vietnam-address-api";
import { recruitmentArray } from "../api/recruitment-api";
import {
  recruitmentOptions,
  recruitmentText,
} from "../utils/recruitment-format";
import type {
  RecruitmentEditorState,
  RecruitmentLookups,
  RecruitmentValues,
  RecruitmentOption,
} from "../types";
const emptyOptions: RecruitmentOption[] = [];

export function useRecruitmentAddress(
  state: RecruitmentEditorState,
  form: UseFormReturn<RecruitmentValues>,
  lookups: RecruitmentLookups,
  userId: number | null,
) {
  const enabled = ["candidate", "create-candidate", "view-candidate"].includes(
    state.action,
  );
  const readonly = state.action === "view-candidate";
  const [upgraded, setUpgraded] = useState(false);
  const legacy =
    !upgraded &&
    Boolean(state.row.city_code) &&
    !/^\d{5}$/.test(recruitmentText(state.row.district_code));
  const [selectedCity, selectedWard] = useWatch({
    control: form.control,
    name: ["city_code", "district_code"],
  });
  const city = readonly
    ? recruitmentText(state.row.city_code)
    : String(selectedCity ?? "");
  const previousCity = useRef(city);
  const { isSubmitted } = form.formState;
  const provinces = useQuery({
    queryKey: ["vietnam-address-v2-provinces"],
    queryFn: ({ signal }) => listVietnamProvinces(signal),
    enabled: enabled && !legacy,
    staleTime: 86400000,
    retry: false,
  });
  const subdivisions = useQuery({
    queryKey: legacy
      ? ["recruitment-districts", userId, city]
      : ["vietnam-address-v2-wards", city],
    queryFn: ({ signal }) =>
      legacy
        ? recruitmentArray("/list_district/", { city_code: city }, signal).then(
            (rows) => recruitmentOptions(rows, "code"),
          )
        : listVietnamWards(city, signal),
    enabled: enabled && Boolean(city),
    staleTime: legacy ? 60000 : 86400000,
    retry: false,
  });
  useEffect(() => {
    if (!readonly && city !== previousCity.current) {
      form.setValue("district_code", "", { shouldValidate: isSubmitted });
      previousCity.current = city;
    }
  }, [city, form, readonly, isSubmitted]);
  useEffect(() => {
    if (!enabled || readonly) return;
    // Recheck existing errors when address selections or their options change.
    const invalid = ["city_code", "district_code"].filter(
      (name) => form.getFieldState(name).error,
    );
    if (invalid.length) void form.trigger(invalid);
  }, [
    city,
    selectedWard,
    provinces.data,
    subdivisions.data,
    enabled,
    readonly,
    form,
  ]);
  const cities = legacy
    ? (lookups.cities ?? emptyOptions)
    : (provinces.data ?? emptyOptions);
  const districts = subdivisions.data ?? emptyOptions;
  useEffect(() => {
    if (!enabled || !readonly) return;
    const province = cities.find(
      (option) => option.value === recruitmentText(state.row.city_code),
    );
    const ward = districts.find(
      (option) => option.value === recruitmentText(state.row.district_code),
    );
    if (province) form.setValue("city_code", province.label);
    if (ward) form.setValue("district_code", ward.label);
  }, [
    enabled,
    readonly,
    cities,
    districts,
    state.row.city_code,
    state.row.district_code,
    form,
  ]);
  const queries = [subdivisions];
  if (!legacy) queries.push(provinces);
  return {
    enabled,
    legacy,
    cities,
    districts,
    provinces,
    subdivisions,
    queries: enabled ? queries : [],
    upgrade: () => {
      setUpgraded(true);
      form.setValue("city_code", "", { shouldValidate: isSubmitted });
      form.setValue("district_code", "", { shouldValidate: isSubmitted });
    },
  };
}
