export default class Http {
    #baseURL;

    constructor({ baseURL }) {
        this.#baseURL = baseURL;
    }

    // Private method for making HTTP requests
    async #request(endpoint, options = {}) {
        const access_token = localStorage.getItem("access_token");

        const isFormData = options.body instanceof FormData;

        const response = await fetch(`${this.#baseURL}${endpoint}`, {
            ...options,
            headers: {
                Authorization: `Bearer ${access_token}`,
                ...(isFormData ? {} : { "Content-Type": "application/json" }),
                ...options.headers,
            },
            body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : null,
        });

        const data = await response.json();

        if (!response.ok) return Promise.reject(data.error);
        return data;
    }

    get(endpoint, options = {}) {
        return this.#request(endpoint, { method: "GET", ...options });
    }

    post(endpoint, options = {}) {
        return this.#request(endpoint, { method: "POST", ...options });
    }

    put(endpoint, options = {}) {
        return this.#request(endpoint, { method: "PUT", ...options });
    }

    delete(endpoint, options = {}) {
        return this.#request(endpoint, { method: "DELETE", ...options });
    }
}
