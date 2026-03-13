export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    
    // Fetch with streaming
    const response = await fetch(decodedUrl, {
      headers: request.headers,
    });

    // Create a readable stream
    const { readable, writable } = new TransformStream();
    
    // Pipe the response body to the writable stream
    response.body.pipeTo(writable);

    // Return streaming response
    return new Response(readable, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Content-Length': response.headers.get('content-length'),
        'Content-Disposition': response.headers.get('content-disposition') || 'attachment',
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    return new Response('Streaming error: ' + error.message, { status: 500 });
  }
}
