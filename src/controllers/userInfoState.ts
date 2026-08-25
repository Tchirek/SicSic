import type { UserInfo } from '@waline/api';
import { makePersisted } from '@solid-primitives/storage';
import { login } from '@waline/api';
import { createMemo, createRoot, createSignal, onCleanup, onMount } from 'solid-js';

import { refresh } from './commentListState';
import configProvider from './configProvider';

let profileWindow: Window | null = null;
let profileOrigin = '';

const userInfoState = createRoot(() => {
  const [userInfo, setUserInfo] = makePersisted(createSignal<UserInfo | null>(null), {
    name: 'WALINE_USER',
    deserialize: (data) => {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    },
    serialize: (data) => JSON.stringify(data),
  });
  const isLogin = createMemo(() => Boolean(userInfo()?.token));
  const isAdmin = createMemo(() => Boolean(userInfo()?.type === 'administrator'));

  const onMessageReceive = (event: MessageEvent<{ type?: string; data?: UserInfo }>): void => {
    if (event.source !== profileWindow || event.origin !== profileOrigin) return;
    const { data } = event;
    if (!data || data.type !== 'profile' || !data.data) return;
    const profile = data.data;
    setUserInfo((usrInfo) => (usrInfo ? { ...usrInfo, ...profile } : profile));
    [localStorage, sessionStorage]
      .filter((store) => store.getItem('WALINE_USER'))
      .forEach((store) => store.setItem('WALINE_USER', JSON.stringify(userInfo)));
  };

  onMount(() => {
    window.addEventListener('message', onMessageReceive);
  });
  onCleanup(() => {
    window.removeEventListener('message', onMessageReceive);
  });
  return { userInfo, isLogin, setUserInfo, isAdmin };
});

export async function userLogin() {
  const { config } = configProvider;
  const { setUserInfo } = userInfoState;
  const res = await login({ serverURL: config().serverURL, lang: config().lang });
  // TODO: respect remember option
  const { remember, ...rest } = res;
  setUserInfo({ ...rest });
}

export async function userLogout() {
  const { setUserInfo } = userInfoState;
  setUserInfo(null);
  localStorage.removeItem('WALINE_USER');
  sessionStorage.removeItem('WALINE_USER');
  refresh();
}

export async function openProfile() {
  const { config } = configProvider;
  const { userInfo } = userInfoState;
  const { serverURL, lang } = config();
  const width = 800;
  const height = 800;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;
  const query = new URLSearchParams({
    lng: lang,
    token: userInfo()!.token,
  });
  profileOrigin = new URL(serverURL, window.location.href).origin;
  profileWindow = window.open(
    `${serverURL}/ui/profile?${query.toString()}`,
    '_blank',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=no,resizable=no,status=no,location=no,toolbar=no,menubar=no`,
  );
  profileWindow?.postMessage({ type: 'TOKEN', data: userInfo()!.token }, profileOrigin);
}

export default userInfoState;
