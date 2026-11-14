import { Pipe, PipeTransform } from '@angular/core';

import { resourceLink } from '../resource-mgt/resource-link';
import { MentionedPerson, linkPeople } from './link-people';

/**
 * Links the people a Quinn answer mentions to their records in Resource Management.  Runs on the
 * Markdown, before the `markdown` pipe: `message.content | linkPeople: message.people | markdown`.
 */
@Pipe({ name: 'linkPeople' })
export class LinkPeoplePipe implements PipeTransform {
  transform(markdown: string, people: readonly MentionedPerson[] | null | undefined): string {
    return linkPeople(markdown, people, resourceLink);
  }
}
