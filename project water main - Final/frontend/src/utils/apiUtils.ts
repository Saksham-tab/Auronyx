/**
 * Utility functions for API calls with robust JSON error handling
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Safe JSON parsing with error handling
 */
export async function safeJsonParse(response: Response): Promise<ApiResponse> {
  try {
    const responseText = await response.text();
    
    if (!responseText) {
      return {
        success: false,
        message: 'Empty response from server'
      };
    }

    try {
      return JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON response:', parseError);
      console.error('Response text:', responseText);
      
      return {
        success: false,
        message: 'Invalid response format from server',
        error: responseText.substring(0, 200) // Include first 200 chars for debugging
      };
    }
  } catch (error) {
    console.error('Failed to read response:', error);
    return {
      success: false,
      message: 'Failed to read server response'
    };
  }
}

/**
 * Enhanced fetch with automatic JSON error handling
 */
export async function safeFetch(
  url: string, 
  options?: RequestInit
): Promise<{ response: Response; data: ApiResponse }> {
  try {
    const response = await fetch(url, options);
    const data = await safeJsonParse(response);
    
    return { response, data };
  } catch (error) {
    console.error('Network error:', error);
    return {
      response: new Response(null, { status: 0 }),
      data: {
        success: false,
        message: 'Network error: Unable to connect to server'
      }
    };
  }
}

/**
 * Handle API response with consistent error handling
 */
export function handleApiResponse<T>(
  response: Response,
  data: ApiResponse<T>
): T {
  if (!response.ok) {
    throw new Error(data?.message || `Server error: ${response.status}`);
  }
  
  if (!data.success) {
    throw new Error(data?.message || 'Request failed');
  }
  
  return data.data as T;
}
