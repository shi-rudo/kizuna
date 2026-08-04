const stableVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const releaseCandidateVersionPattern =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-rc\.(0|[1-9]\d*)$/;

export const getTargetDistTag = (version) => {
	if (releaseCandidateVersionPattern.test(version)) {
		return "rc";
	}

	if (stableVersionPattern.test(version)) {
		return "latest";
	}

	if (version.includes("-")) {
		throw new Error(`Unsupported prerelease version: ${version}`);
	}

	throw new Error(`Invalid Semantic Version: ${version}`);
};

export const assertReleaseState = ({
	packageName,
	packageVersion,
	jsrVersion,
	npmVersion,
	distTags,
	published,
	publishedPackages,
}) => {
	const targetDistTag = getTargetDistTag(packageVersion);
	const errors = [];

	if (jsrVersion !== packageVersion) {
		errors.push(
			`jsr.json version ${jsrVersion} does not match package.json version ${packageVersion}.`,
		);
	}

	if (npmVersion !== packageVersion) {
		errors.push(
			`npm version ${npmVersion} does not match package.json version ${packageVersion}.`,
		);
	}

	if (distTags?.[targetDistTag] !== packageVersion) {
		errors.push(
			`npm dist-tag ${targetDistTag} points to ${distTags?.[targetDistTag] ?? "nothing"}, not ${packageVersion}.`,
		);
	}

	const outputContainsRelease = publishedPackages.some(
		(release) =>
			release.name === packageName && release.version === packageVersion,
	);

	if (published && !outputContainsRelease) {
		errors.push(
			`workflow output reports a publication but does not contain ${packageName}@${packageVersion}.`,
		);
	}

	if (!published && publishedPackages.length > 0) {
		errors.push(
			"workflow output reports no publication but contains published packages.",
		);
	}

	if (errors.length > 0) {
		throw new Error(`Release verification failed:\n- ${errors.join("\n- ")}`);
	}

	return { targetDistTag };
};
