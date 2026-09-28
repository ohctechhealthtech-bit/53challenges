const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

const toSnakeCase = (str) => {
	return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
	if (isNode) {
		return defaultValue;
	}
	const storageKey = `base44_${toSnakeCase(paramName)}`;
	const urlParams = new URLSearchParams(window.location.search);
	const searchParam = urlParams.get(paramName);
	if (removeFromUrl) {
		urlParams.delete(paramName);
		const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""
			}${window.location.hash}`;
		window.history.replaceState({}, document.title, newUrl);
	}
	if (searchParam) {
		storage.setItem(storageKey, searchParam);
		return searchParam;
	}
	if (defaultValue) {
		storage.setItem(storageKey, defaultValue);
		return defaultValue;
	}
	const storedValue = storage.getItem(storageKey);
	if (storedValue) {
		return storedValue;
	}
	return null;
}


// A credential is never accepted from the URL.
//
// Anything in ?access_token= used to be stored under base44_access_token and
// returned as the app's token. Since our own login began issuing the JWT under
// that key, it is what the entity API authenticates — so a crafted link would
// have silently signed a visitor into whatever session it carried, and
// everything they did afterwards would have landed in it.
//
// The parameter is still stripped from the address bar, so it does not linger
// in history or leak through a referrer, but the value is discarded. The token
// is read from storage, where only our login and exchange write it.
const readAccessToken = () => {
	if (isNode) {
		return undefined;
	}
	const urlParams = new URLSearchParams(window.location.search);
	if (urlParams.has('access_token')) {
		urlParams.delete('access_token');
		const query = urlParams.toString();
		window.history.replaceState({}, document.title,
			`${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
	}
	try {
		return storage.getItem('base44_access_token') || null;
	} catch {
		return null;
	}
};
const getAppParams = () => {
	if (getAppParamValue("clear_access_token") === 'true') {
		storage.removeItem('base44_access_token');
		storage.removeItem('token');
	}
	return {
		appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
		token: readAccessToken(),
		fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
		functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
		appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
	}
}


export const appParams = {
	...getAppParams()
}
