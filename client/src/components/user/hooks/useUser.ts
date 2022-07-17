import { AxiosResponse } from 'axios';

import type { User } from '../../../../../shared/types';
import { axiosInstance, getJWTHeader } from '../../../axiosInstance';
import { queryKeys } from '../../../react-query/constants';
import {
  clearStoredUser,
  getStoredUser,
  setStoredUser,
} from '../../../user-storage';
import { useQuery, useQueryClient } from 'react-query';
import { useState } from 'react';

async function getUser(
  user: User | null,
  signal: AbortSignal,
): Promise<User | null> {
  if (!user) return null;
  const { data }: AxiosResponse<{ user: User }> = await axiosInstance.get(
    `/user/${user.id}`,
    {
      headers: getJWTHeader(user),
      signal,
    },
  );
  return data.user;
}

interface UseUser {
  user: User | null;
  updateUser: (user: User) => void;
  clearUser: () => void;
}

export function useUser(): UseUser {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(getStoredUser());

  // call useQuery to update user data from the server
  useQuery(queryKeys.user, ({ signal }) => getUser(user, signal), {
    enabled: !!user,
    onSuccess: (data) => setUser(data),
  });

  // const { data: user } = useQuery(queryKeys.user, () => getUser(user), {
  //   initialData: getStoredUser,
  //   onSuccess: (received: User | null) => {
  //     if (!received) {
  //       clearStoredUser();
  //     } else {
  //       setStoredUser(received);
  //     }
  //   },
  // });

  // meant to be called from useAuth
  function updateUser(newUser: User): void {
    // set user in state
    setUser(newUser);

    // update user in localStorage
    setStoredUser(newUser);

    queryClient.setQueryData(queryKeys.user, newUser);
  }

  // meant to be called from useAuth
  function clearUser() {
    // update state
    setUser(null);

    // remove from localstorage
    clearStoredUser();

    queryClient.setQueryData(queryKeys.user, null);
    queryClient.removeQueries([queryKeys.appointments, queryKeys.user]);
  }

  return { user, updateUser, clearUser };
}
