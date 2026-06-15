VERCEL ?= vercel

.PHONY: deploy

deploy:
	npm test
	npm run build:assets
	$(VERCEL) --prod
