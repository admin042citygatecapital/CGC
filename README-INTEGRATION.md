# City Gate Capital — Media Assets & Documentation Integration

## Overview

This branch integrates media management systems, API documentation, and platform configuration files for the City Gate Capital digital banking platform.

## Files Integrated

### Media Management Scripts

- **`public/airo-logo-orientation.js`** - Runtime logo orientation correction
  - Fetches media manifest and corrects logo sizing for orientation mismatches
  - Handles square-to-horizontal and vertical layout conversions
  - Uses MutationObserver for React-rendered images
  - Dev mode: 3-second polling for HMR updates

- **`public/airo-video-slots.js`** - Video slot patching system
  - Converts `<img>` elements to `<video>` for video media
  - Supports background video integration
  - Dev mode polling for Vite HMR integration
  - Prevents duplicate video elements after React re-renders

### Media Configuration

- **`public/airo-media.json`** - Centralized media manifest
  - Logo assets (primary, horizontal, vertical)
  - Page hero images
  - Media metadata and orientation data
  - Extensible format for new media types

### Analytics & Headers

- **`public/analytics.js`** - GDPR/CCPA-compliant analytics initialization
- **`public/_headers`** - Cloudflare CDN cache headers and security policies
- **`public/_redirects`** - Domain redirect rules (www → apex)

### API Documentation

- **`docs/api-documentation.md`** - Complete API route documentation
  - Frontend pages
  - Public endpoints
  - Customer endpoints
  - Admin endpoints
  - Rate limits and authentication

- **`docs/openapi.yaml`** - OpenAPI 3.1.0 specification
  - Machine-readable API schema
  - Security schemes and components
  - Endpoint definitions

## Integration Notes

### Script Loading

These scripts should be loaded in your HTML `<head>` before React hydration:

```html
<script src="/airo-logo-orientation.js"></script>
<script src="/airo-video-slots.js"></script>
<script src="/analytics.js"></script>
```

### Media Manifest

The `airo-media.json` file is automatically fetched by the management scripts. Update this file when:
- Adding new logo variants
- Changing media URLs
- Updating media metadata or orientation data

### CDN Configuration

Cloudflare headers (`_headers`) configure:
- **Immutable assets**: 1-year cache for hashed JS/CSS
- **Media uploads**: 1-week cache for user uploads
- **Security**: nosniff headers, frame denial, referrer policy

### Documentation

- **Markdown** (`api-documentation.md`): Human-readable API reference
- **OpenAPI** (`openapi.yaml`): For tools like Swagger UI, Postman, or code generation

## Development

### Dev Mode Features

Both `airo-logo-orientation.js` and `airo-video-slots.js` support development mode:

```javascript
// Auto-detected by:
window.__AIRO_DEV_MODE__ === true
location.hostname === 'localhost'
location.hostname === '127.0.0.1'
```

Dev mode enables:
- 3-second manifest polling for HMR updates
- Console warnings on fetch failures
- Auto-retry with 5-failure cutoff

## Testing

1. **Logo correction**: Upload misaligned logos and verify scaling
2. **Video patching**: Test video replacement in both inline and background contexts
3. **Dev polling**: Modify `airo-media.json` and verify live updates
4. **Cache headers**: Verify CDN behavior with curl or browser DevTools

## Next Steps

1. Load scripts in your main HTML template (`index.html`)
2. Ensure `/airo-media.json` is accessible via your CDN/server
3. Configure logo paths in `SLOT_TO_EXPECTED_LAYOUT` if different
4. Test video slots with actual video URLs
5. Validate API documentation against your implementation
6. Deploy to staging and test end-to-end
