compile_all:
	make compile_node
	make compile_browser
	make compile_amd

compile_node:
	compile-modules accumulators.js preload.js --to node --type 'cjs'

compile_browser:
	compile-modules accumulators.js --to browser --type globals --globals reducers
	compile-modules preload.js --to browser --type globals --globals reducers --imports reducers:reducers

compile_amd:
	compile-modules accumulators.js --to amd --type 'amd'

tests:
	make compile_node
	mocha --ui bdd --reporter list --timeout 2000 ./test/accumulators.js

docco:
	docco accumulators.js