"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormField from "@/components/FormField";
import { calcPricePerPerson, formatWon } from "@/lib/calc";
import { createPost } from "@/lib/posts";
import { saveToken } from "@/lib/tokens";
import { Category } from "@/types/post";

const CATEGORIES: Category[] = ["생필품", "식재료", "배달비"];

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none";

interface FormValues {
  title: string;
  category: Category;
  productUrl: string;
  totalPrice: string;
  targetCount: string;
  pickupPlace: string;
  pickupAt: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

type FormErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
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

function validate(values: FormValues): FormErrors {
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
  if (!values.pickupAt) errors.pickupAt = "픽업 날짜와 시간을 선택해주세요.";

  if (!values.bankName.trim()) errors.bankName = "은행명을 입력해주세요.";
  if (!/^\d{8,16}$/.test(values.accountNumber)) {
    errors.accountNumber = "계좌번호는 숫자만 8~16자리로 입력해주세요.";
  }
  if (!values.accountHolder.trim()) {
    errors.accountHolder = "예금주를 입력해주세요.";
  }

  return errors;
}

export default function WritePage() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 4차시: 총 결제 금액 ÷ 공구 인원 = 1인당 분담금 (입력할 때마다 자동 계산)
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
    if (!file) {
      setImagePreview(null);
      return;
    }
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      // 글 + 정산 계좌 + 방장의 참여를 DB에 한 번에 저장합니다.
      const { postId, token } = await createPost({
        title: values.title.trim(),
        category: values.category,
        productUrl: values.productUrl.trim(),
        totalPrice: Number(values.totalPrice),
        targetCount: Number(values.targetCount),
        pickupPlace: values.pickupPlace.trim(),
        pickupAt: new Date(values.pickupAt).toISOString(),
        bankName: values.bankName.trim(),
        accountNumber: values.accountNumber,
        accountHolder: values.accountHolder.trim(),
      });
      // 방장이 자기 글의 계좌를 다시 볼 수 있도록 참여 토큰을 이 브라우저에 저장해요.
      saveToken(postId, token);
      router.push(`/post/${postId}`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "저장 중 알 수 없는 오류가 났어요."
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md px-4 pt-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-200"
        >
          뒤로가기
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">공동구매 글쓰기</h1>
      </div>

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

          <FormField
            label="은행명"
            htmlFor="bankName"
            error={errors.bankName}
          >
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
          label="상품 이미지 (선택)"
          htmlFor="image"
          hint="미리보기만 되고 아직 저장되지는 않아요."
        >
          <input
            id="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:text-blue-600"
          />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt="선택한 상품 이미지 미리보기"
              className="mt-2 h-32 w-32 rounded-lg object-cover"
            />
          )}
        </FormField>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow disabled:opacity-60"
        >
          {submitting ? "저장하는 중..." : "글쓰기"}
        </button>

        {submitError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="font-medium">저장하지 못했어요.</p>
            <p className="mt-1 break-words">{submitError}</p>
          </div>
        )}
      </form>
    </main>
  );
}
