# Nitro Fetch

A lightweight, modern HTTP client library inspired by Axios, built with TypeScript. Nitro Fetch provides a simple and intuitive API for making HTTP requests with features like retries, interceptors, and endpoint management.

## Features

- Promise-based API
- Request and response interceptors
- Automatic JSON data transformation
- Request timeout support
- TypeScript support with full type definitions
- Configurable base URL
- Query parameter handling
- Custom headers support
- Endpoints registration
- Retry mechanism for both failed and successful requests
- Multiple module formats (ESM, CommonJS, UMD)
- Browser and Node.js support

## Installation

Choose your preferred package manager:

```bash
# npm
npm install nitro-fetch

# yarn
yarn add nitro-fetch

# pnpm
pnpm add nitro-fetch
```

Include the minified UMD bundle in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/nitro-fetch@1.0.1/dist/umd/nitro-fetch.min.js'></script>
```

or 

```html
<script src="https://unpkg.com/nitro-fetch@1.0.0/dist/umd/nitro-fetch.min.js"></script>

```


## Usage

### Browser Usage

```html
<script>
  const api = NitroFetch.create({
    baseURL: 'https://api.example.com',
    retry: {
      count: 3,
      delay: 1000
    }
  });

  // Make requests
  api.get('/users')
    .then(response => console.log(response.data))
    .catch(error => console.error(error));
</script>
```

### Node.js / Modern JavaScript

```typescript
// ESM
import { create } from 'nitro-fetch';

// CommonJS
const { create } = require('nitro-fetch');

const api = create({
  baseURL: 'https://api.example.com',
  headers: {
    'Authorization': 'Bearer token'
  },
  retry: {
    count: 3,
    delay: 1000,
    retryOnSuccess: true,
    shouldRetry: (response) => {
      // Retry if the response doesn't meet certain conditions
      return response.status === 200 && !response.data.isValid;
    }
  }
});

// GET request
const response = await api.get('/users');

// POST request with data
const newUser = await api.post('/users', {
  name: 'John Doe',
  email: 'john@example.com'
});

// PUT request
const updatedUser = await api.put('/users/1', {
  name: 'John Smith'
});

// DELETE request
await api.delete('/users/1');
```

### Advanced Usage

#### Named Endpoints

```typescript
const api = create({
  baseURL: 'https://api.example.com'
});

// Register a single endpoint
api.registerEndpoint('getUser', {
  method: 'GET',
  path: '/users/:id',
  config: {
    params: { include: 'profile' }
  }
});

// Register multiple endpoints
api.registerEndpoints({
  createUser: {
    method: 'POST',
    path: '/users',
    config: {
      headers: { 'Content-Type': 'application/json' }
    }
  },
  updateUser: {
    method: 'PUT',
    path: '/users/:id'
  }
});

// Call endpoints by name
const user = await api.call('getUser', null, { params: { id: 123 } });
```

#### Interceptors

```typescript
// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token
    config.headers['Authorization'] = `Bearer ${getToken()}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    // Transform response data
    response.data = transformData(response.data);
    return response;
  },
  (error) => {
    // Handle specific error cases
    if (error.response?.status === 401) {
      refreshToken();
    }
    return Promise.reject(error);
  }
);
```

#### Retry Configuration

```typescript
const api = create({
  retry: {
    count: 3,
    delay: 1000,
    retryOnSuccess: true,
    shouldRetry: (response) => {
      // Retry on specific conditions
      return response.status === 200 && !response.data.isValid;
    },
    onRetry: (error, attempt) => {
      console.log(`Retry attempt ${attempt}`);
    }
  }
});

// Per-request retry configuration
const response = await api.get('/users', {
  retry: {
    count: 5,
    delay: 2000,
    shouldRetry: (error) => {
      return error.message.includes('timeout');
    }
  }
});
```

#### Error Handling

```typescript
try {
  const response = await api.get('/users');
  console.log(response.data);
} catch (error) {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.log(error.response.data);
    console.log(error.response.status);
    console.log(error.response.headers);
  } else if (error.request) {
    // The request was made but no response was received
    console.log(error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.log('Error', error.message);
  }
}
```

## API Reference

### Configuration Options

```typescript
interface RequestConfig {
  baseURL?: string;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retry?: {
    count?: number;
    delay?: number;
    onRetry?: (error: Error | Response, attempt: number) => void;
    shouldRetry?: (error: Error | Response) => boolean;
    retryOnSuccess?: boolean;
  };
}
```

### Response Structure

```typescript
interface Response<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}
```

### Methods

- `get(url: string, config?: RequestConfig): Promise<Response<T>>`
- `post(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>`
- `put(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>`
- `delete(url: string, config?: RequestConfig): Promise<Response<T>>`
- `patch(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>`
- `registerEndpoint(name: string, endpoint: ApiEndpoint): void`
- `registerEndpoints(endpoints: Record<string, ApiEndpoint>): void`
- `call<T = any>(name: string, data?: any, config?: RequestConfig): Promise<Response<T>>`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 