// The markup guard of every page (SPEC-0004 rule 2, the register's residual on responses.ts, closed by this change): it
// inspects tags and attributes, not text. A requirement's title that contains "style =" or " onX=" is escaped text and
// renders; a real script or style element, a style attribute, an event-handler attribute or a javascript: address is
// refused, however it is written. Marker REQ-104 AC2. No network.
import assert from "node:assert/strict";
import { test } from "node:test";
import { htmlPage } from "../src/core/index.ts";

const refused = (body: string): void => assert.throws(() => htmlPage("t", body), /not allowed/, JSON.stringify(body));
const allowed = async (body: string): Promise<string> => {
  const response = htmlPage("t", body);
  assert.equal(response.status, 200);
  return response.text();
};

test("REQ-104 AC2: escaped text that looks like an attribute, a tag or a script address renders", async () => {
  const texts = [
    "<p>A requirement title with style = in it</p>",
    "<p>A title with style=inline</p>",
    "<p>The title is x onclick = y</p>",
    "<p>x onload=y and onerror =z</p>",
    "<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>",
    "<p>&lt;style&gt;p{}&lt;/style&gt; &lt;a onclick=&quot;x()&quot;&gt;</p>",
    "<p>&lt;p style=&quot;color:red&quot;&gt;</p>",
    "<p>see javascript:alert(1) as text</p>",
    "<h2>Implement “style = tokens” (REQ-105)</h2>",
    "<p>a < b and 3 <4 and x<=y</p>",
    '<p data-onclick="x" data-style="y" styles="z" title="onclick=">attribute names that only contain the words</p>',
    '<a href="https://github.com/acme/api/pull/7?a=1&amp;b=2">#7</a>',
    '<link rel="stylesheet" href="/style.css"><meta charset="utf-8">',
    '<a title="a>b onclick=x" href="/x">a quoted greater-than sign is not the end of the tag</a>',
    "<p title='style=x onclick=y'>quoted values are values</p>",
  ];
  for (const body of texts) assert.ok((await allowed(body)).includes(body), body);
});

test("REQ-104 AC2: a script or style element is refused however it is written", () => {
  for (const body of ["<script>x()</script>", "<SCRIPT>x()</SCRIPT>", "<script src=/x.js></script>", "<script/x>", "<script\n>", "<script\t>", "<ScRiPt>", "<style>p{}</style>", "<STYLE media=all>", "<style\n>", "</script>", "</style>", "<p>text<script>x()</script></p>", "<div><style>p{}</style></div>"]) refused(body);
});

test("REQ-104 AC2: a style attribute or an event-handler attribute is refused, in any case, quoting and spacing", () => {
  for (const body of [
    '<p style="color:red">x</p>',
    "<p style='color:red'>x</p>",
    "<p style=color:red>x</p>",
    "<p STYLE=x>x</p>",
    "<p style>x</p>",
    '<p  style  =  "x">x</p>',
    '<p class="a" style="x">x</p>',
    '<a onclick="x()">x</a>',
    "<a ONCLICK=x>x</a>",
    "<img src=x onerror=y>",
    "<img src=x\nonerror=y>",
    "<p\tonclick=x>x</p>",
    "<p/onclick=x>x</p>",
    '<a title="a>b" onclick=x>x</a>',
    "<a href='x' onfocus=y>x</a>",
    "<svg onload=x>",
    "<body onload=x>",
    "<p onmouseover>x</p>",
    '<a title="x"style="y">x</a>',
  ]) refused(body);
});

test("REQ-104 AC2: a javascript: address in an attribute is refused, however it is dressed", () => {
  for (const body of [
    '<a href="javascript:x()">x</a>',
    '<a href=" JavaScript:x()">x</a>',
    "<a href=javascript:x()>x</a>",
    '<a href="java&#x09;script:x()">x</a>',
    '<a href="java&#9;script:x()">x</a>',
    '<a href="java&Tab;script:x()">x</a>',
    '<a href="java&NewLine;script:x()">x</a>',
    '<a href="&#106;avascript:x()">x</a>',
    '<a href="&#x6A;avascript&colon;x()">x</a>',
    '<a href="java\tscript:x()">x</a>',
    '<a href="\u0001javascript:x()">x</a>',
    '<form action="javascript:x()"><button>x</button></form>',
    '<button formaction="javascript:x()">x</button>',
    '<img src="javascript:x()">',
    "<a href='  javascript:x()'>x</a>",
  ]) refused(body);
});

test("REQ-104 AC2: a comment, a processing instruction, an odd declaration or a tag that never ends is refused", () => {
  for (const body of ["<!-- <b> -->", "<!--", "<?php x ?>", "<!DOCTYPE foo>", "<![CDATA[x]]>", "<p onclick", '<a href="x', "<p title='x", "<p "]) refused(body);
});

test("REQ-104 AC2: the guard reads the whole page, including the title, and the page's own markup is allowed", async () => {
  const html = await allowed("<p>ok</p>");
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes("<title>t</title>"));
  const titled = htmlPage("style = onclick=x </title><script>", "<p>ok</p>");
  const text = await titled.text();
  assert.ok(!text.includes("<script>"), "the title is escaped");
  assert.ok(text.includes("&lt;/title&gt;&lt;script&gt;"));
});
