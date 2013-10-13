compile_all:
	make compile_node
	make compile_browser
	make compile_amd

compile_node:
	compile-modules accumulators.js --to node --type cjs

compile_browser:
	compile-modules accumulators.js --to browser --type globals --globals reducers
	uglifyjs browser/accumulators.js --compress --mangle --output browser/accumulators.min.js

compile_amd:
	compile-modules accumulators.js --to amd --type 'amd'

tests:
	make compile_node
	mocha --ui bdd --reporter list --timeout 2000 ./test/accumulators.js

docco:
	docco accumulators.js

