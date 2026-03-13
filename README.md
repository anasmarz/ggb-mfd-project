This fork is strictly for testing purposes

## Static vocabulary dataset

This fork has been updated to use a static JSON vocabulary dataset instead of querying Strapi at runtime:

- Vocabulary entries are exported from Strapi into `public/vocab.json` (plus `public/vocab-search.json`) using `npm run export-vocab`.
- The export script is wired into the build: `npm run build` will run `npm run export-vocab && react-scripts build`.
- Frontend alphabet and vocab APIs (`alphabetAPI`, `vocabAPI`) now read from `/vocab.json` served by the CDN instead of calling the Strapi `bims` endpoint directly.

To refresh the dataset after changing content in Strapi:

1. Run `npm run export-vocab` locally to regenerate `public/vocab.json`.
2. Commit the updated JSON (or let CI regenerate it during `npm run build`).
3. Deploy as usual; the CDN will serve the new static dataset.
