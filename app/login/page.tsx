"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none";

type Mode = "login" | "signup";

// 로그인 뒤에 돌아갈 곳. 같은 사이트 안의 주소("/post/..." 등)만 허용해요.
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setNotice(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return setError("이메일을 입력해주세요.");
    if (password.length < 6) {
      return setError("비밀번호는 6자 이상으로 입력해주세요.");
    }
    if (mode === "signup" && !nickname.trim()) {
      return setError("닉네임을 입력해주세요.");
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { needsConfirm } = await signUp(
          trimmedEmail,
          password,
          nickname.trim()
        );
        if (needsConfirm) {
          setNotice(
            "가입 완료! 이메일로 보낸 인증 링크를 누른 뒤 로그인해주세요."
          );
          setMode("login");
          setSubmitting(false);
          return;
        }
      } else {
        await signIn(trimmedEmail, password);
      }
      router.push(nextPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 났어요.");
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
          홈으로
        </Link>
        <h1 className="text-lg font-semibold text-gray-100">
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        {mode === "signup" && (
          <div>
            <label
              htmlFor="nickname"
              className="mb-1 block text-sm font-medium text-gray-800"
            >
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              placeholder="예) 승우"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-800"
          >
            이메일
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@email.com"
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-800"
          >
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 rounded-full bg-blue-600 px-5 py-3 text-sm font-medium text-white shadow disabled:opacity-60"
        >
          {submitting
            ? "처리하는 중..."
            : mode === "login"
              ? "로그인"
              : "가입하기"}
        </button>

        {notice && (
          <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {notice}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
            <p className="break-words">{error}</p>
          </div>
        )}
      </form>

      <p className="mt-4 text-center text-sm text-gray-400">
        {mode === "login" ? "아직 계정이 없나요?" : "이미 계정이 있나요?"}{" "}
        <button
          type="button"
          onClick={() => switchMode(mode === "login" ? "signup" : "login")}
          className="text-blue-400 underline"
        >
          {mode === "login" ? "회원가입" : "로그인"}
        </button>
      </p>
    </main>
  );
}
