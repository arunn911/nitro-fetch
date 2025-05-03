export interface RequestConfig {
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

export interface Response<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config: RequestConfig;
}

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  config?: RequestConfig;
  data?: any;
  id?: string;
}

export interface InterceptorManager<V> {
  use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number;
  eject(id: number): void;
  clear(): void;
}

export interface RequestInterceptor {
  onFulfilled?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  onRejected?: (error: any) => any;
}

export interface ResponseInterceptor {
  onFulfilled?: (response: Response) => Response | Promise<Response>;
  onRejected?: (error: any) => any;
}

export interface INitroFetch {
  interceptors: {
    request: InterceptorManager<RequestConfig>;
    response: InterceptorManager<Response>;
  };
  get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  delete<T = any>(url: string, config?: RequestConfig): Promise<Response<T>>;
  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
  registerEndpoint(name: string, endpoint: ApiEndpoint): void;
  registerEndpoints(endpoints: Record<string, ApiEndpoint>): void;
  call<T = any>(name: string, data?: any, config?: RequestConfig): Promise<Response<T>>;
}

export type CreateNitroFetch = (config?: RequestConfig) => NitroFetch; 

class InterceptorManagerImpl<V> implements InterceptorManager<V> {
  private _interceptors: Array<{
    onFulfilled?: (value: V) => V | Promise<V>;
    onRejected?: (error: any) => any;
  } | null> = [];

  get interceptors() {
    return this._interceptors;
  }

  use(onFulfilled?: (value: V) => V | Promise<V>, onRejected?: (error: any) => any): number {
    this._interceptors.push({
      onFulfilled,
      onRejected,
    });
    return this._interceptors.length - 1;
  }

  eject(id: number): void {
    if (this._interceptors[id]) {
      this._interceptors[id] = null;
    }
  }

  clear(): void {
    this._interceptors = [];
  }

  forEach(fn: (interceptor: { onFulfilled?: (value: V) => V | Promise<V>; onRejected?: (error: any) => any }) => void): void {
    this._interceptors.forEach(interceptor => {
      if (interceptor !== null) {
        fn(interceptor);
      }
    });
  }
}

export class NitroFetch implements INitroFetch {
  private config: RequestConfig;
  private requestInterceptors: InterceptorManagerImpl<RequestConfig>;
  private responseInterceptors: InterceptorManagerImpl<Response>;
  private endpoints: Record<string, ApiEndpoint> = {};
  public interceptors: {
    request: InterceptorManagerImpl<RequestConfig>;
    response: InterceptorManagerImpl<Response>;
  };

  constructor(config: RequestConfig = {}) {
    this.config = config;
    this.requestInterceptors = new InterceptorManagerImpl<RequestConfig>();
    this.responseInterceptors = new InterceptorManagerImpl<Response>();
    this.interceptors = {
      request: this.requestInterceptors,
      response: this.responseInterceptors,
    };
  }

  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<Response<T>> {
    let mergedConfig = { ...this.config, ...config };
    const retryConfig = mergedConfig.retry || {};
    const maxRetries = retryConfig.count ?? 0;
    const retryDelay = retryConfig.delay ?? 1000;
    const shouldRetry = retryConfig.shouldRetry ?? ((error: Error | Response) => true);
    const onRetry = retryConfig.onRetry;
    const retryOnSuccess = retryConfig.retryOnSuccess ?? false;

    let attempt = 0;
    let lastError: Error | Response | null = null;

    while (attempt <= maxRetries) {
      try {
        let mergedConfig = { ...this.config, ...config };
        
        // Apply request interceptors
        try {
          for (const interceptor of this.requestInterceptors.interceptors) {
            if (interceptor?.onFulfilled) {
              mergedConfig = await interceptor.onFulfilled(mergedConfig);
            }
          }
        } catch (error) {
          throw error;
        }

        const fullUrl = this.buildUrl(url, mergedConfig);
        const headers = this.buildHeaders(mergedConfig);

        const controller = new AbortController();
        const timeoutId = mergedConfig.timeout
          ? setTimeout(() => controller.abort(), mergedConfig.timeout)
          : null;

        try {
          const response = await fetch(fullUrl, {
            method,
            headers,
            body: data ? JSON.stringify(data) : undefined,
            signal: controller.signal,
          });

          const responseData = await this.parseResponse<T>(response);

          let responseObject: Response<T> = {
            data: responseData,
            status: response.status,
            statusText: response.statusText,
            headers: this.parseHeaders(response.headers),
            config: mergedConfig,
          };

          // Apply response interceptors
          try {
            for (const interceptor of this.responseInterceptors.interceptors) {
              if (interceptor?.onFulfilled) {
                responseObject = await interceptor.onFulfilled(responseObject);
              }
            }
          } catch (error) {
            throw error;
          }

          // Check if we should retry on successful response
          if (attempt < maxRetries && retryOnSuccess && shouldRetry(responseObject)) {
            attempt++;
            if (onRetry) {
              onRetry(responseObject, attempt);
            }
            await this.delay(retryDelay);
            continue;
          }

          return responseObject;
        } catch (error) {
          // Apply response error interceptors
          try {
            for (const interceptor of this.responseInterceptors.interceptors) {
              if (interceptor?.onRejected) {
                error = await interceptor.onRejected(error);
              }
            }
          } catch (interceptorError) {
            throw interceptorError;
          }
          throw error;
        } finally {
          if (timeoutId) clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries && shouldRetry(lastError)) {
          attempt++;
          if (onRetry) {
            onRetry(lastError, attempt);
          }
          await this.delay(retryDelay);
          continue;
        }
        throw lastError;
      }
    }

    throw lastError;
  }

  private buildUrl(url: string, config: RequestConfig): string {
    const baseURL = config.baseURL || '';
    const fullUrl = new URL(url, baseURL);
    
    if (config.params) {
      Object.entries(config.params).forEach(([key, value]) => {
        fullUrl.searchParams.append(key, String(value));
      });
    }

    return fullUrl.toString();
  }

  private buildHeaders(config: RequestConfig): Headers {
    const headers = new Headers(config.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {};
    headers.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  private async parseResponse<T>(response: globalThis.Response): Promise<T> {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json();
    }
    return response.text() as unknown as T;
  }

  get<T = any>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>('GET', url, undefined, config);
  }

  post<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>('POST', url, data, config);
  }

  put<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>('PUT', url, data, config);
  }

  delete<T = any>(url: string, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>('DELETE', url, undefined, config);
  }

  patch<T = any>(url: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    return this.request<T>('PATCH', url, data, config);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  /**
   * Register an endpoint with a name
   * @param name The name to register the endpoint under
   * @param endpoint The endpoint configuration
   */
  registerEndpoint(name: string, endpoint: ApiEndpoint): void {
    if (!endpoint.id) {
      endpoint.id = name;
    }
    this.endpoints[name] = endpoint;
  }

  /**
   * Register multiple endpoints at once
   * @param endpoints An object mapping endpoint names to their configurations
   */
  registerEndpoints(endpoints: Record<string, ApiEndpoint>): void {
    Object.entries(endpoints).forEach(([name, endpoint]) => {
      this.registerEndpoint(name, endpoint);
    });
  }

  /**
   * Call a registered endpoint by name
   * @param name The name of the endpoint to call
   * @param data Optional data to override the endpoint's default data
   * @param config Optional config to override the endpoint's default config
   */
  async call<T = any>(name: string, data?: any, config?: RequestConfig): Promise<Response<T>> {
    const endpoint = this.endpoints[name];
    if (!endpoint) {
      throw new Error(`Endpoint '${name}' not found`);
    }

    const mergedConfig = {
      ...this.config,
      ...endpoint.config,
      ...config,
    };

    return this.request<T>(
      endpoint.method,
      endpoint.path,
      data ?? endpoint.data,
      mergedConfig
    );
  }
}

export const create: CreateNitroFetch = (config?: RequestConfig) => new NitroFetch(config); 
const nitro = new NitroFetch();
export default nitro;