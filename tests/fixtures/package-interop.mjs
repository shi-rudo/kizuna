import { createRequire } from "node:module";
import { ContainerBuilder as EsmContainerBuilder } from "@shirudo/kizuna";

const require = createRequire(import.meta.url);
const { ContainerBuilder: CjsContainerBuilder } = require("@shirudo/kizuna");

function createSource(ContainerBuilder, marker) {
	return new ContainerBuilder()
		.registerSingletonFactory("shared", () => ({ marker }))
		.build();
}

function borrowWith(ContainerBuilder, source) {
	return new ContainerBuilder()
		.borrowSingletonFrom(source, "shared")
		.build();
}

const cjsSource = createSource(CjsContainerBuilder, "cjs");
const esmBorrower = borrowWith(EsmContainerBuilder, cjsSource);
if (esmBorrower.get("shared") !== cjsSource.get("shared")) {
	throw new Error("The ESM borrower did not resolve the CJS singleton");
}

const esmSource = createSource(EsmContainerBuilder, "esm");
const cjsBorrower = borrowWith(CjsContainerBuilder, esmSource);
if (cjsBorrower.get("shared") !== esmSource.get("shared")) {
	throw new Error("The CJS borrower did not resolve the ESM singleton");
}

const packageEntry = import.meta.resolve("@shirudo/kizuna");
const duplicatePackage = await import(`${packageEntry}?duplicate=1`);
const duplicateSource = createSource(duplicatePackage.ContainerBuilder, "duplicate");
const duplicateBorrower = borrowWith(EsmContainerBuilder, duplicateSource);
if (duplicateBorrower.get("shared") !== duplicateSource.get("shared")) {
	throw new Error("The borrower did not resolve the duplicate-package singleton");
}

duplicateBorrower.dispose();
duplicateSource.dispose();
cjsBorrower.dispose();
esmSource.dispose();
esmBorrower.dispose();
cjsSource.dispose();
