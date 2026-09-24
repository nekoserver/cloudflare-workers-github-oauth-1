package main

import (
	"strings"
	"testing"
)

func TestDiffText_NoChange(t *testing.T) {
	got := DiffText("a\nb\nc\n", "a\nb\nc\n")
	if !strings.HasPrefix(got, "差分なし") {
		t.Fatalf("expected 差分なし summary, got:\n%s", got)
	}
}

func TestDiffText_InsertionAndDeletion(t *testing.T) {
	got := DiffText("a\nb\nc\n", "a\nx\nc\n")
	if !strings.Contains(got, "1行追加, 1行削除") {
		t.Fatalf("expected 1行追加, 1行削除 in summary, got:\n%s", got)
	}
	if !strings.Contains(got, "- b") {
		t.Fatalf("expected deleted line '- b', got:\n%s", got)
	}
	if !strings.Contains(got, "+ x") {
		t.Fatalf("expected inserted line '+ x', got:\n%s", got)
	}
	if !strings.Contains(got, "  a") || !strings.Contains(got, "  c") {
		t.Fatalf("expected unchanged lines '  a'/'  c', got:\n%s", got)
	}
}

func TestDiffText_WrapsInDiffFence(t *testing.T) {
	got := DiffText("a\n", "b\n")
	if !strings.Contains(got, "```diff\n") || !strings.HasSuffix(got, "```") {
		t.Fatalf("expected ```diff fenced block, got:\n%s", got)
	}
}

func TestDiffText_OnlyInsertions(t *testing.T) {
	got := DiffText("a\n", "a\nb\nc\n")
	if !strings.Contains(got, "2行追加, 0行削除") {
		t.Fatalf("expected 2行追加, 0行削除, got:\n%s", got)
	}
}

func TestDiffText_EmptyInputs(t *testing.T) {
	got := DiffText("", "")
	if !strings.HasPrefix(got, "差分なし") {
		t.Fatalf("expected 差分なし for two empty strings, got:\n%s", got)
	}
}

func TestDiffText_NoRawBoxDrawingCharacters(t *testing.T) {
	got := DiffText("a\nb\n", "a\nc\n")
	for _, forbidden := range []string{"├", "└", "│", "─", "┼"} {
		if strings.Contains(got, forbidden) {
			t.Fatalf("output must not contain box-drawing characters (CLAUDE.md rule 16), found %q in:\n%s", forbidden, got)
		}
	}
}
