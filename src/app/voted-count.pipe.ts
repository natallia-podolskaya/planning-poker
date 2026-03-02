import { Pipe, PipeTransform } from '@angular/core';
import { Member } from './types';

@Pipe({ name: 'votedCount', standalone: true })
export class VotedCountPipe implements PipeTransform {
  transform(members: Member[]): number {
    return members.filter((m) => m.voted).length;
  }
}
