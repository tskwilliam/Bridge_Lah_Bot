import { useState } from 'react';
import type { Member } from '../../types/game';
export function MemberAvatar({ member }: { member: Member }) {
  const [failed, setFailed] = useState(false);
  return <span className={`member-avatar avatar-${member.id} ${member.photoUrl && !failed ? 'has-photo' : ''}`}>
    {member.photoUrl && !failed ? <img src={member.photoUrl} alt={`${member.username} profile`} onError={() => setFailed(true)}/> : <span aria-label={`${member.username} profile placeholder`}>{member.initials}</span>}
  </span>;
}
