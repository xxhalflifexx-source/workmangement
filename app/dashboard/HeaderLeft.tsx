"use client";

import UserMenu from "./UserMenu";

interface HeaderLeftProps {
  userName: string | null | undefined;
  userEmail: string | null | undefined;
  userRole?: string;
}

export default function HeaderLeft({ userName, userEmail, userRole }: HeaderLeftProps) {
  return (
    <UserMenu 
      userName={userName} 
      userEmail={userEmail}
      userRole={userRole}
    />
  );
}

