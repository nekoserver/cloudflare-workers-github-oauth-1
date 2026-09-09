package main

import "testing"

func TestBuildAttachedMarkdown_AppendsUnreferenced(t *testing.T) {
	got := buildAttachedMarkdown("本文です", []attachmentIn{
		{Filename: "login.png", Alt: "ログイン画面", URL: "https://example.com/a.png"},
	})
	want := "本文です\n\n![ログイン画面](https://example.com/a.png)"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestBuildAttachedMarkdown_RewritesExistingReference(t *testing.T) {
	got := buildAttachedMarkdown("見て ![元のalt](login.png) これ", []attachmentIn{
		{Filename: "login.png", Alt: "フォールバックalt", URL: "https://example.com/a.png"},
	})
	want := "見て ![元のalt](https://example.com/a.png) これ"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestBuildAttachedMarkdown_VideoIsBareURL(t *testing.T) {
	got := buildAttachedMarkdown("", []attachmentIn{
		{Filename: "demo.mp4", Alt: "demo.mp4", URL: "https://example.com/demo.mp4", IsVideo: true},
	})
	want := "https://example.com/demo.mp4"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

// cli/cli本家のaltEscaper(internal/attachments/userasset.go)は `[` `]` `\`
// と改行のみをエスケープし、丸括弧はエスケープしない
// (`]` を潰せば `](url)` を閉じられなくなるため、それだけで十分という設計)。
func TestBuildAttachedMarkdown_EscapesAltBrackets(t *testing.T) {
	got := buildAttachedMarkdown("", []attachmentIn{
		{Filename: "x.png", Alt: "a](https://evil.example/)[b", URL: "https://example.com/a.png"},
	})
	want := "![a\\](https://evil.example/)\\[b](https://example.com/a.png)"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestBuildAttachedMarkdown_MultipleAttachments(t *testing.T) {
	got := buildAttachedMarkdown("前 ![alt1](a.png) 後", []attachmentIn{
		{Filename: "a.png", Alt: "a", URL: "https://example.com/a.png"},
		{Filename: "b.png", Alt: "b", URL: "https://example.com/b.png"},
	})
	want := "前 ![alt1](https://example.com/a.png) 後\n\n![b](https://example.com/b.png)"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
