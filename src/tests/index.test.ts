import { create } from '..';

describe('NitroFetch', () => {
  let api: ReturnType<typeof create>;

  beforeEach(() => {
    api = create({
      baseURL: 'https://jsonplaceholder.typicode.com',
    });
  });

  it('should make a GET request', async () => {
    const response = await api.get('/todos/1');
    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty('id');
    expect(response.data).toHaveProperty('title');
  });

  it('should make a POST request', async () => {
    const newTodo = {
      title: 'Test Todo',
      completed: false,
      userId: 1,
    };

    const response = await api.post('/todos', newTodo);
    expect(response.status).toBe(201);
    expect(response.data).toMatchObject(newTodo);
  });

  it('should handle query parameters', async () => {
    const response = await api.get('/todos', {
      params: {
        userId: 1,
      },
    });
    expect(response.status).toBe(200);
    expect(Array.isArray(response.data)).toBe(true);
  });

  it('should handle custom headers', async () => {
    const apiWithHeaders = create({
      baseURL: 'https://jsonplaceholder.typicode.com',
      headers: {
        'X-Custom-Header': 'test-value',
      },
    });

    const response = await apiWithHeaders.get('/todos/1');
    expect(response.status).toBe(200);
  });

  it('should handle errors', async () => {
    try {
      await api.get('/nonexistent');
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  describe('Interceptors', () => {
    it('should modify request config with request interceptor', async () => {
      api.interceptors.request.use((config) => {
        config.headers = {
          ...config.headers,
          'X-Custom-Header': 'test-value',
        };
        return config;
      });

      const response = await api.get('/todos/1');
      expect(response.status).toBe(200);
    });

    it('should modify response data with response interceptor', async () => {
      api.interceptors.response.use((response) => {
        response.data = {
          ...response.data,
          customField: 'test-value',
        };
        return response;
      });

      const response = await api.get('/todos/1');
      expect(response.data).toHaveProperty('customField');
      expect(response.data.customField).toBe('test-value');
    });

    it('should handle request interceptor errors', async () => {
      api.interceptors.request.use(
        () => {
          throw new Error('Request interceptor error');
        },
        (error) => {
          if (error instanceof Error) {
            expect(error.message).toBe('Request interceptor error');
          }
          return Promise.reject(error);
        }
      );

      try {
        await api.get('/todos/1');
        fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toBe('Request interceptor error');
        } else {
          fail('Error should be an instance of Error');
        }
      }
    });

    it('should handle response interceptor errors', async () => {
      api.interceptors.response.use(
        () => {
          throw new Error('Response interceptor error');
        },
        (error) => {
          if (error instanceof Error) {
            expect(error.message).toBe('Response interceptor error');
          }
          return Promise.reject(error);
        }
      );

      try {
        await api.get('/todos/1');
        fail('Should have thrown an error');
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).toBe('Response interceptor error');
        } else {
          fail('Error should be an instance of Error');
        }
      }
    });

    it('should remove interceptors', async () => {
      const interceptorId = api.interceptors.request.use((config) => {
        config.headers = {
          ...config.headers,
          'X-Custom-Header': 'test-value',
        };
        return config;
      });

      api.interceptors.request.eject(interceptorId);

      const response = await api.get('/todos/1');
      expect(response.status).toBe(200);
      expect(response.config.headers?.['X-Custom-Header']).toBeUndefined();
    });

    it('should clear all interceptors', async () => {
      api.interceptors.request.use((config) => {
        config.headers = {
          ...config.headers,
          'X-Custom-Header': 'test-value',
        };
        return config;
      });

      api.interceptors.request.clear();

      const response = await api.get('/todos/1');
      expect(response.status).toBe(200);
      expect(response.config.headers?.['X-Custom-Header']).toBeUndefined();
    });
  });
}); 