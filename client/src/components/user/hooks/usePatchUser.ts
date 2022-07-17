import jsonpatch from 'fast-json-patch';

import type { User } from '../../../../../shared/types';
import { axiosInstance, getJWTHeader } from '../../../axiosInstance';
import { useUser } from './useUser';
import { UseMutateFunction, useMutation, useQueryClient } from 'react-query';
import { useCustomToast } from '../../app/hooks/useCustomToast';
import { queryKeys } from '../../../react-query/constants';

// for when we need a server function
async function patchUserOnServer(
  newData: User | null,
  originalData: User | null,
): Promise<User | null> {
  if (!newData || !originalData) return null;
  // create a patch for the difference between newData and originalData
  const patch = jsonpatch.compare(originalData, newData);

  // send patched data to the server
  const { data } = await axiosInstance.patch(
    `/user/${originalData.id}`,
    { patch },
    {
      headers: getJWTHeader(originalData),
    },
  );
  return data.user;
}

export function usePatchUser(): UseMutateFunction<
  User,
  unknown,
  User,
  unknown
> {
  const { user, updateUser } = useUser();
  const toast = useCustomToast();
  const queryClient = useQueryClient();

  const { mutate: patchUser } = useMutation(
    (newUserData: User) => patchUserOnServer(newUserData, user),
    {
      // onMutate returned context that is passe to onError
      onMutate: async (newData: User | null) => {
        // cancel any outgoing queries for user data, so old server data doesn't overwrite out optimistic update
        queryClient.cancelQueries(queryKeys.user);
        //  snapshot of previous user value
        const previousUserData: User = queryClient.getQueryData(queryKeys.user);
        //  optimistically updata the cache with new user value
        updateUser(newData);
        //  return context object with snapshotted value
        return { previousUserData };
      },
      onError: (error, data, context) => {
        //  roll back cache to saved value
        if (context.previousUserData) {
          updateUser(context.previousUserData);
          toast({
            title: 'update failed; restoring previous values',
            status: 'error',
          });
        }
      },
      onSuccess: (userData: User | null) => {
        if (user) {
          updateUser(userData);
          toast({
            title: 'User updated',
            status: 'success',
          });
        }
      },
      onSettled: () => {
        //  invalidate user query to make sure qw're in sync with the server data
        queryClient.invalidateQueries(queryKeys.user);
      },
    },
  );

  return patchUser;
}
