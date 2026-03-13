export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  
  // Get the target URL from query parameters
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { 
      status: 400,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }

  try {
    // Validate URL
    const decodedUrl = decodeURIComponent(targetUrl);
    new URL(decodedUrl); // Validate URL format
    
    // Handle different request methods
    const requestMethod = request.method;
    
    // Prepare headers for the proxied request
    const headers = new Headers(request.headers);
    
    // Remove hop-by-hop headers
    const hopByHopHeaders = [
      'connection', 'keep-alive', 'proxy-authenticate', 
      'proxy-authorization', 'te', 'trailers', 
      'transfer-encoding', 'upgrade', 'content-length'
    ];
    
    hopByHopHeaders.forEach(header => headers.delete(header));
    
    // Add or modify headers for better compatibility
    headers.set('User-Agent', 'Mozilla/5.0 (compatible; DownloadProxy/1.0)');
    
    // Create the proxied request
    const proxyRequest = new Request(decodedUrl, {
      method: requestMethod,
      headers: headers,
      body: requestMethod !== 'GET' && requestMethod !== 'HEAD' ? request.body : null,
      redirect: 'follow'
    });

    // Fetch the target URL
    const response = await fetch(proxyRequest);

    // Prepare response headers
    const responseHeaders = new Headers(response.headers);
    
    // Add CORS headers for cross-origin requests
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', '*');
    
    // Handle range requests for resume support
    const range = request.headers.get('range');
    if (range) {
      responseHeaders.set('Accept-Ranges', 'bytes');
    }

    // Set content disposition for downloads
    const contentDisposition = getContentDisposition(response, decodedUrl);
    if (contentDisposition) {
      responseHeaders.set('Content-Disposition', contentDisposition);
    }

    // Create the response
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    return new Response('Error processing request: ' + error.message, { 
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

// Helper function to get content disposition
function getContentDisposition(response, url) {
  const contentType = response.headers.get('content-type');
  const contentDisposition = response.headers.get('content-disposition');
  
  if (contentDisposition) {
    return contentDisposition;
  }
  
  // Generate filename from URL if no content disposition
  if (contentType && !contentType.includes('text/html')) {
    try {
      const urlObj = new URL(url);
      const filename = urlObj.pathname.split('/').pop() || 'download';
      return `attachment; filename="${filename}"`;
    } catch (e) {
      return 'attachment; filename="download"';
    }
  }
  
  return null;
}
