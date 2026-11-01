"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import FormField from "@/components/FormField";
import { calcPricePerPerson, formatWon } from "@/lib/calc";
import { checkImageFile } from "@/lib/storage";
import { Category } from "@/types/post";

export const CATEGORIES: Category[] = ["생필품", "식재료", "배달비"];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none";

export interface FormValues {
  title: string;
  category: Category;
  productUrl: string;
  totalPrice: string;
  targetCount: string;
  pickupPlace: string;
  pickupAt: string; // datetime-local 형식 (예: 2026-11-05T14:00)
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export const emptyValues: FormValues = {
  title: "",
  category: "생필품",
  productUrl: "",
  totalPrice: "",
  targetCount: "",
  pickupPlace: "",
  pickupAt: "",
  bankName: "",
  accountNumber: "",
  accountHolder: "",
};

/** ISO 시각을 datetime-local 입력 칸 형식(내 시간대)으로 바꿔요. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 사진 선택 결과: 새 사진(file), 올려 둔 사진을 지울지(clear) */
export interface ImageChange {
  file: File | null;
  clear: boolean;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues, pickupMustBeFuture: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!values.title.trim()) errors.title = "모집글 제목을 입력해주세요.";

  if (!values.productUrl.trim()) {
    errors.productUrl = "상품 링크나 상품명을 입력해주세요.";
  }

  const price = Number(values.totalPrice);
  if (!values.totalPrice || !Number.isFinite(price) || price <= 0) {
    errors.totalPrice = "총 결제 금액을 1원 이상으로 입력해주세요.";
  }

  const count = Number(values.targetCount);
  if (!values.targetCount || !Number.isInteger(count) || count < 2) {
    errors.targetCount = "공구 인원은 2명 이상의 정수로 입력해주세요.";
  }

  if (!values.pickupPlace.trim()) {
    errors.pickupPlace = "픽업할 장소를 입력해주세요.";
  }
  if (!values.pickupAt) {
    errors.pickupAt = "픽업 날짜와 시간을 선택해주세요.";
  } else if (
    pickupMustBeFuture &&
    new Date(values.pickupAt).getTime() <= Date.now()
  ) {
    errors.pickupAt = "픽업 시간은 지금보다 이후로 선택해주세요.";
  }

  if (!values.bankName.trim()) errors.bankName = "은행명을 입력해주세요.";
  if (!/^\d{8,16}$/.test(values.accountNumber)) {
    errors.accountNumber = "계좌번호는 숫자만 8~16자리로 입력해주세요.";
  }
  if (!values.accountHolder.trim()) {
    errors.accountHolder = "예금주를 입력해주세요.";
  }

  return errors;
}

interface PostFormProps {
  initialValues: FormValues;
  initialImageUrl?: string | null; // 수정할 때 이미 올라가 있는 사진
  submitLabel: string;
  submittingLabel: string;
  /** 검사를 통과하면 불려요. 실패하면 오류를 던지면 화면에 보여줘요. */
  onSubmit: (values: FormValues, image: ImageChange) => Promise<void>;
}

// 글쓰기와 글 수정이 함께 쓰는 입력 양식
export default function PostForm({
  initialValues,
  initialImageUrl = null,
  submitLabel,
  submittingLabel,
  onSubmit,
}: PostFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [clearExisting, setClearExisting] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : null),
    [imageFile]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const shownImage =
    previewUrl ?? (clearExisting ? null : initialImageUrl ?? null);

  // 총 결제 금액 ÷ 공구 인원 = 1인당 분담금 (입력할 때마다 자동 계산)
  const pricePerPerson = calcPricePerPerson(
    Number(values.totalPrice),
    Number(values.targetCount)
  );

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setSubmitError(null);
  };

  // 숫자만 입력되도록 걸러주는 핸들러 (금액·인원·계좌번호용)
  const handleNumberChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const onlyDigits = value.replace(/\D/g, "");
    setValues((prev) => ({ ...prev, [name]: onlyDigits }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    setSubmitError(null);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return; // 파일 선택 창을 취소했을 때는 지금 사진을 그대로 둬요.
    const problem = checkImageFile(file);
    if (problem) {
      setImageError(problem);
      setFileInputKey((k) => k + 1);
      return;
    }
    setImageError(null);
    setImageFile(file);
    setClearExisting(false);
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setClearExisting(true);
    setImageError(null);
    setFileInputKey((k) => k + 1); // 같은 사진을 다시 고를 수 있게 선택 칸을 비워요.
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    // 수정할 때 픽업 시간을 그대로 두면 "지금보다 이후" 검사는 건너뛰어요.
    const pickupChanged = values.pickupAt !== initialValues.pickupAt;
    const nextErrors = validate(values, pickupChanged);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(values, {
        file: imageFile,
        clear: clearExisting && imageFile === null,
      });
      // 성공하면 부른 쪽에서 다른 화면으로 넘어가요.
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "저장 중 알 수 없는 오류가 났어요."
      );
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <FormField label="모집글 제목" htmlFor="title" error={errors.title}>
        <input
          id="title"
          name="title"
          type="text"
          value={values.title}
          onChange={handleChange}
          placeholder="예) 몬스터 에너지 드링크 36개입 같이 사실 분"
          className={inputClass}
        />
      </FormField>

      <FormField label="카테고리" htmlFor="category">
        <select
          id="category"
          name="category"
          value={values.category}
          onChange={handleChange}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

      <FormField
        label="상품 링크 또는 상품명"
        htmlFor="productUrl"
        error={errors.productUrl}
      >
        <input
          id="productUrl"
          name="productUrl"
          type="text"
          value={values.productUrl}
          onChange={handleChange}
          placeholder="https://coupang.com/item/12345..."
          className={inputClass}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="총 결제 금액(원)"
          htmlFor="totalPrice"
          error={errors.totalPrice}
        >
          <input
            id="totalPrice"
            name="totalPrice"
            type="text"
            inputMode="numeric"
            value={values.totalPrice}
            onChange={handleNumberChange}
            placeholder="30000"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="공구 인원(명)"
          htmlFor="targetCount"
          error={errors.targetCount}
        >
          <input
            id="targetCount"
            name="targetCount"
            type="text"
            inputMode="numeric"
            value={values.targetCount}
            onChange={handleNumberChange}
            placeholder="10"
            className={inputClass}
          />
        </FormField>
      </div>

      <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm">
        {pricePerPerson === null ? (
          <span className="text-gray-500">
            총 결제 금액과 공구 인원을 입력하면 1인당 분담금이 자동으로
            계산돼요.
          </span>
        ) : (
          <span className="text-blue-700">
            1인당 분담금:{" "}
            <strong className="font-semibold">
              {formatWon(pricePerPerson)}
            </strong>{" "}
            (자동계산)
          </span>
        )}
      </div>

      <FormField
        label="픽업 및 나눔 장소"
        htmlFor="pickupPlace"
        error={errors.pickupPlace}
      >
        <input
          id="pickupPlace"
          name="pickupPlace"
          type="text"
          value={values.pickupPlace}
          onChange={handleChange}
          placeholder="예) 대전역 2번 출구 앞"
          className={inputClass}
        />
      </FormField>

      <FormField
        label="픽업 날짜·시간"
        htmlFor="pickupAt"
        error={errors.pickupAt}
        hint="지금보다 이후 시간만 고를 수 있어요."
      >
        <input
          id="pickupAt"
          name="pickupAt"
          type="datetime-local"
          value={values.pickupAt}
          onChange={handleChange}
          className={inputClass}
        />
      </FormField>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3">
        <legend className="px-1 text-sm font-medium text-gray-800">
          정산받을 계좌
        </legend>

        <FormField label="은행명" htmlFor="bankName" error={errors.bankName}>
          <input
            id="bankName"
            name="bankName"
            type="text"
            value={values.bankName}
            onChange={handleChange}
            placeholder="예) 토스뱅크"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="계좌번호"
          htmlFor="accountNumber"
          error={errors.accountNumber}
          hint="숫자만 입력해주세요. 이 글에 참여한 사람에게만 공개돼요."
        >
          <input
            id="accountNumber"
            name="accountNumber"
            type="text"
            inputMode="numeric"
            value={values.accountNumber}
            onChange={handleNumberChange}
            placeholder="1234567890123"
            className={inputClass}
          />
        </FormField>

        <FormField
          label="예금주"
          htmlFor="accountHolder"
          error={errors.accountHolder}
        >
          <input
            id="accountHolder"
            name="accountHolder"
            type="text"
            value={values.accountHolder}
            onChange={handleChange}
            placeholder="예) 임승우"
            className={inputClass}
          />
        </FormField>
      </fieldset>

      <FormField
        label="상품 사진 (선택)"
        htmlFor="image"
        error={imageError ?? undefined}
        hint="JPG, PNG, WEBP, GIF · 5MB 이하. 다시 고르면 바뀌고, 삭제 버튼으로 뺄 수 있어요."
      >
        <input
          key={fileInputKey}
          id="image"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleImageChange}
          className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:text-blue-600"
        />
        {shownImage && (
          <div className="mt-2 flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shownImage}
              alt="선택한 상품 사진 미리보기"
              className="h-32 w-32 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700"
            >
              사진 삭제
            </button>
          </div>
        )}
      </FormField>

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow disabled:opacity-60"
      >
        {submitting ? submittingLabel : submitLabel}
      </button>

      {submitError && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <p className="font-medium">저장하지 못했어요.</p>
          <p className="mt-1 break-words">{submitError}</p>
        </div>
      )}
    </form>
  );
}
