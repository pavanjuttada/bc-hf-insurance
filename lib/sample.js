/**
 * Claim the Insurance
 * @param {org.example.insurance.ClaimInsurance} claimInsurance
 * @transaction
 */
async function claimInsurance(claimInsuranceRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.insurance';

    const claimApp = factory.newResource(namespace, 'ClaimApplication', claimInsuranceRequest.id);
    claimApp.applicant = factory.newRelationship(namespace, 'VehicleOwner', claimInsuranceRequest.applicant.getIdentifier());

    claimApp.type = claimInsuranceRequest.type
    claimApp.firReference = claimInsuranceRequest.firReference
    claimApp.description = claimInsuranceRequest.description
    claimApp.status = 'APPLIED';

    claimApp.approval = [factory.newRelationship(namespace, 'VehicleOwner', claimInsuranceRequest.applicant.getIdentifier())];

    //save the application
    const assetRegistry = await getAssetRegistry(claimApp.getFullyQualifiedType());
    await assetRegistry.add(claimApp);


    // emit event
    const applicationEvent = factory.newEvent(namespace, 'ClaimInsuranceEvent');
    applicationEvent.claimApplication = claimApp;
    emit(applicationEvent);
}

/**
 * Approve the ClaimApplication
 * @param {org.example.insurance.Approve} approve
 * @transaction
 */
async function approve(approveRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.insurance';

    let claimApp = approveRequest.claimApplication;

    if (claimApp.status === 'CLOSED' || claimApp.status === 'REJECTED') {
        throw new Error ('This claimApp has already been closed');
    } else if (claimApp.approval.length === 3) {
        throw new Error ('All three parties have already approved this claimApp');
    } else if (claimApp.approval.includes(approveRequest.approvingParty)) {
        throw new Error ('This person has already approved this claimApp');
    } else if (approveRequest.approvingParty.getType() === 'Police') {
        claimApp.approval.forEach((approvingParty) => {
            if (approvingParty.getType() === 'Police') {
                throw new Error('Your police has already approved of this request');
            }
        });
        claimApp.firReference = approveRequest.firReference;
        claimApp.status = 'APPROVED_POLICE';
    } else if (approveRequest.approvingParty.getType() === 'Insurancer') {
        claimApp.approval.forEach((approvingParty) => {
            if (approvingParty.getType() === 'Insurancer') {
                throw new Error('Your Insurancer has already approved of this request');
            }
        });
    //TO-DO check status of police approval or Repairshop invoice
    //TO-DO check status of vehicale lock
        claimApp.status = 'APPROVED';
    }

    claimApp.approval.push(factory.newRelationship(namespace, approveRequest.approvingParty.getType(), approveRequest.approvingParty.getIdentifier()));
    
    // update approval[]
    const assetRegistry = await getAssetRegistry(approveRequest.claimApplication.getFullyQualifiedType());
    await assetRegistry.update(claimApp);

    // emit event
    const approveEvent = factory.newEvent(namespace, 'ApproveEvent');
    approveEvent.claimApplication = approveRequest.claimApplication;
    approveEvent.approvingParty = approveRequest.approvingParty;
    emit(approveEvent);
}

/**
 * Reject the ClaimApplication
 * @param {org.example.insurance.Reject} reject
 * @transaction
 */
async function reject(rejectRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.insurance';

    let claimApp = rejectRequest.claimApplication;

    if (claimApp.status === 'CLOSED' || claimApp.status === 'REJECTED') {
        throw new Error ('This claimApp has already been closed');
    } else if (claimApp.status === 'APPROVED') {
        throw new Error ('This claimApp has already been approved');
    } else {
        claimApp.status = 'REJECTED';
        claimApp.closeReason = rejectRequest.closeReason;

        const assetRegistry = await getAssetRegistry(rejectRequest.claimApplication.getFullyQualifiedType());
        await assetRegistry.update(claimApp);

        // emit event
        const rejectEvent = factory.newEvent(namespace, 'RejectEvent');
        rejectEvent.claimApplication = rejectRequest.claimApplication;
        rejectEvent.closeReason = rejectRequest.closeReason;
        emit(rejectEvent);
    }
}

/**
 * Close the ClaimApplication
 * @param {org.example.insurance.Close} close
 * @transaction
 */
async function close(closeRequest) { // eslint-disable-line no-unused-vars
    const factory = getFactory();
    const namespace = 'org.example.insurance';

    let claimApp = closeRequest.claimApplication;
    if (claimApp.status === 'APPROVED') {
        claimApp.status = 'CLOSED';
        claimApp.closeReason = closeRequest.closeReason;

        const assetRegistry = await getAssetRegistry(closeRequest.claimApplication.getFullyQualifiedType());
        await assetRegistry.update(claimApp);

        // emit event
        const closeEvent = factory.newEvent(namespace, 'CloseEvent');
        closeEvent.claimApplication = closeRequest.claimApplication;
        closeEvent.closeReason = closeRequest.closeReason;
        emit(closeEvent);
    } else if (claimApp.status === 'CLOSED' || claimApp.status === 'REJECTED') {
        throw new Error('This claimApp has already been closed');
    } else {
        throw new Error('Cannot close this claimApp until it is fully approved');
    }
}