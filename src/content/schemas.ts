import { z } from 'zod';
export const schemas = {
  home: z.object({
    "hero": z.object({
      "trustBadge": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "headline2": z.string(),
      "subheadline": z.string(),
      "ctaSecondary": z.string(),
      "trustBadges": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      })),
      "heroCTALabels": z.object({
        "control": z.string(),
        "urgency": z.string(),
        "benefit": z.string()
      })
    }),
    "stats": z.array(z.object({
      "id": z.string(),
      "value": z.number(),
      "suffix": z.string(),
      "label": z.string()
    })),
    "trustBadges": z.array(z.object({
      "id": z.string(),
      "label": z.string()
    })),
    "features": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "items": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "dashboard": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      }))
    }),
    "transfers": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "crypto": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "ctaLabel": z.string(),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "wallet": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "ctaLabel": z.string(),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "security": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "zeroIncidentsHeadline": z.string(),
      "zeroIncidentsSub": z.string(),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "mobileApp": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "awardLabel": z.string(),
      "awardSub": z.string(),
      "appChips": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      })),
      "featureBullets": z.array(z.object({
        "id": z.string(),
        "title": z.string(),
        "desc": z.string()
      }))
    }),
    "pricing": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "headline2": z.string(),
      "subheadline": z.string(),
      "trustStrip": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      }))
    }),
    "testimonials": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "headline2": z.string(),
      "subheadline": z.string(),
      "featuredQuote": z.string(),
      "featuredName": z.string(),
      "featuredRole": z.string(),
      "pressLabel": z.string(),
      "pressLogos": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      })),
      "items": z.array(z.object({
        "id": z.string(),
        "name": z.string(),
        "role": z.string(),
        "location": z.string(),
        "avatar": z.string(),
        "color": z.string(),
        "rating": z.number(),
        "text": z.string()
      }))
    }),
    "faq": z.object({
      "eyebrow": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "supportLinkLabel": z.string(),
      "stillHaveQuestions": z.string(),
      "liveChatLabel": z.string(),
      "emailLabel": z.string(),
      "items": z.array(z.object({
        "id": z.string(),
        "cat": z.string(),
        "q": z.string(),
        "a": z.string()
      }))
    }),
    "finalCta": z.object({
      "badge": z.string(),
      "headline1": z.string(),
      "headlineAccent": z.string(),
      "subheadline": z.string(),
      "ctaPrimary": z.string(),
      "ctaSecondary": z.string(),
      "featureStrip": z.array(z.object({
        "id": z.string(),
        "label": z.string()
      }))
    }),
    "plans": z.array(z.object({
      "id": z.string(),
      "name": z.string(),
      "tagline": z.string(),
      "monthlyPrice": z.number(),
      "yearlyPrice": z.number(),
      "highlight": z.boolean(),
      "badge": z.string(),
      "color": z.string(),
      "cta": z.string(),
      "features": z.array(z.object({
        "id": z.string(),
        "label": z.string(),
        "included": z.boolean()
      }))
    }))
  }),
  zoho_setup: z.object({
    "header": z.object({
      "title": z.string(),
      "subtitle": z.string()
    }),
    "step1": z.object({
      "label": z.string(),
      "description": z.string(),
      "cta": z.string()
    }),
    "step2": z.object({
      "label": z.string(),
      "description": z.string(),
      "placeholder": z.string(),
      "buttonIdle": z.string(),
      "buttonBusy": z.string()
    }),
    "status": z.object({
      "exchanging": z.string(),
      "tokenLabel": z.string(),
      "copyIdle": z.string(),
      "copiedConfirm": z.string(),
      "warning": z.string()
    }),
    "nextSteps": z.object({
      "label": z.string(),
      "items": z.array(z.object({
        "id": z.string(),
        "text": z.string()
      }))
    })
  })
};
export type Schemas = typeof schemas;