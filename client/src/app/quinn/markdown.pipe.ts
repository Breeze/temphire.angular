import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

/**
 * Renders Markdown - Quinn's answers - to HTML.
 *
 * Bind the result with `[innerHTML]`, never with `bypassSecurityTrustHtml`: Angular's sanitizer then
 * removes scripts, event handlers and `javascript:` links from the HTML, which matters because the
 * text comes from a language model and, through it, from data anyone in the company can edit.
 */
@Pipe({ name: 'markdown' })
export class MarkdownPipe implements PipeTransform {
  transform(markdown: string | null | undefined): string {
    return markdown
      ? (marked.parse(markdown, { async: false, gfm: true, breaks: true }) as string)
      : '';
  }
}
