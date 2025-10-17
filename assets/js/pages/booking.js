/* ----------------------------------------------------------------------------
 * Easy!Appointments - Online Appointment Scheduler
 *
 * @package     EasyAppointments
 * @author      A.Tselegidis <alextselegidis@gmail.com>
 * @copyright   Copyright (c) Alex Tselegidis
 * @license     https://opensource.org/licenses/GPL-3.0 - GPLv3
 * @link        https://easyappointments.org
 * @since       v1.5.0
 * ---------------------------------------------------------------------------- */

/**
 * Booking page.
 *
 * This module implements the functionality of the booking page
 *
 * Old Name: FrontendBook
 */
App.Pages.Booking = (function () {
    const $selectDate = $('#select-date');
    const $selectService = $('#select-service');
    const $selectProvider = $('#select-provider');
    const $selectTimezone = $('#select-timezone');
    const $firstName = $('#first-name');
    const $lastName = $('#last-name');
    const $email = $('#email');
    const $phoneNumber = $('#phone-number');
    const $address = $('#address');
    const $city = $('#city');
    const $zipCode = $('#zip-code');
    const $notes = $('#notes');
    const $captchaTitle = $('.captcha-title');
    const $availableHours = $('#available-hours');
    const $bookAppointmentSubmit = $('#book-appointment-submit');
    const $deletePersonalInformation = $('#delete-personal-information');
    const $customField1 = $('#custom-field-1');
    const $customField2 = $('#custom-field-2');
    const $customField3 = $('#custom-field-3');
    const $customField4 = $('#custom-field-4');
    const $customField5 = $('#custom-field-5');
    const $displayBookingSelection = $('.display-booking-selection');
    const tippy = window.tippy;
    const moment = window.moment;

    let manageMode = vars('manage_mode') || false;

    function detectDatepickerMonthChangeStep(previousDateTimeMoment, nextDateTimeMoment) {
        return previousDateTimeMoment.isAfter(nextDateTimeMoment) ? -1 : 1;
    }

    // NOVO: Exibir foto do profissional ao lado do select
    function updateProviderPhoto() {
        const selectedOption = $selectProvider.find('option:selected');
        const providerId = selectedOption.val();
        const provider = vars('available_providers').find(p => String(p.id) === String(providerId));
        let $photo = $('#provider-photo');
        if (!$photo.length) {
            $photo = $('<img id="provider-photo" class="professional-photo" style="display:none;"/>');
            $selectProvider.before($photo);
        }
        if (provider && provider.photo_url) {
            $photo.attr('src', provider.photo_url).show();
        } else {
            $photo.hide();
        }
    }

    function initialize() {
        if (Boolean(Number(vars('display_cookie_notice'))) && window?.cookieconsent) {
            cookieconsent.initialise({
                palette: {
                    popup: {
                        background: '#ffffffbd',
                        text: '#666666',
                    },
                    button: {
                        background: '#429a82',
                        text: '#ffffff',
                    },
                },
                content: {
                    message: lang('website_using_cookies_to_ensure_best_experience'),
                    dismiss: 'OK',
                },
            });

            const $cookieNoticeLink = $('.cc-link');

            $cookieNoticeLink.replaceWith(
                $('<a/>', {
                    'data-bs-toggle': 'modal',
                    'data-bs-target': '#cookie-notice-modal',
                    'href': '#',
                    'class': 'cc-link',
                    'text': $cookieNoticeLink.text(),
                }),
            );
        }

        manageMode = vars('manage_mode');

        tippy('[data-tippy-content]');

        let monthTimeout;

        App.Utils.UI.initializeDatePicker($selectDate, {
            inline: true,
            minDate: moment().subtract(1, 'day').set({hours: 23, minutes: 59, seconds: 59}).toDate(),
            maxDate: moment().add(vars('future_booking_limit'), 'days').toDate(),
            onChange: (selectedDates) => {
                App.Http.Booking.getAvailableHours(moment(selectedDates[0]).format('YYYY-MM-DD'));
                App.Pages.Booking.updateConfirmFrame();
            },

            onMonthChange: (selectedDates, dateStr, instance) => {
                $selectDate.parent().fadeTo(400, 0.3);

                if (monthTimeout) {
                    clearTimeout(monthTimeout);
                }

                monthTimeout = setTimeout(() => {
                    const previousMoment = moment(instance.selectedDates[0]);
                    const displayedMonthMoment = moment(
                        instance.currentYearElement.value +
                            '-' +
                            String(Number(instance.monthsDropdownContainer.value) + 1).padStart(2, '0') +
                            '-01',
                    );
                    const monthChangeStep = detectDatepickerMonthChangeStep(previousMoment, displayedMonthMoment);

                    App.Http.Booking.getUnavailableDates(
                        $selectProvider.val(),
                        $selectService.val(),
                        displayedMonthMoment.format('YYYY-MM-DD'),
                        monthChangeStep,
                    );
                }, 500);
            },

            onYearChange: (selectedDates, dateStr, instance) => {
                setTimeout(() => {
                    const previousMoment = moment(instance.selectedDates[0]);
                    const displayedMonthMoment = moment(
                        instance.currentYearElement.value +
                            '-' +
                            String(Number(instance.monthsDropdownContainer.value) + 1).padStart(2, '0') +
                            '-01',
                    );
                    const monthChangeStep = detectDatepickerMonthChangeStep(previousMoment, displayedMonthMoment);

                    App.Http.Booking.getUnavailableDates(
                        $selectProvider.val(),
                        $selectService.val(),
                        displayedMonthMoment.format('YYYY-MM-DD'),
                        monthChangeStep,
                    );
                }, 500);
            },
        });

        App.Utils.UI.setDateTimePickerValue($selectDate, new Date());

        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const isTimezoneSupported = $selectTimezone.find(`option[value="${browserTimezone}"]`).length > 0;
        $selectTimezone.val(isTimezoneSupported ? browserTimezone : 'UTC');

        addEventListeners();

        optimizeContactInfoDisplay();

        // NOVO: Preencher profissionais ao iniciar
        fillProviders();

        // NOVO: Se só houver um profissional, já seleciona
        const providerOptionCount = $selectProvider.find('option').length;
        if (providerOptionCount === 2) {
            $selectProvider.find('option[value=""]').remove();
            const firstProviderId = $selectProvider.find('option:first').attr('value');
            $selectProvider.val(firstProviderId).trigger('change');
        }

        // Se manage mode, carrega dados
        if (manageMode) {
            applyAppointmentData(vars('appointment_data'), vars('provider_data'), vars('customer_data'));

            $('#wizard-frame-1')
                .css({
                    'visibility': 'visible',
                    'display': 'none',
                })
                .fadeIn();
        } else {
            // Parâmetros via URL
            const selectedProviderId = App.Utils.Url.queryParam('provider');
            if (selectedProviderId && $selectProvider.find('option[value="' + selectedProviderId + '"]').length > 0) {
                $selectProvider.val(selectedProviderId).trigger('change');
            }

            const selectedServiceId = App.Utils.Url.queryParam('service');
            if (selectedServiceId && $selectService.find('option[value="' + selectedServiceId + '"]').length > 0) {
                $selectService.val(selectedServiceId);
            }

            prefillFromQueryParam('#first-name', 'first_name');
            prefillFromQueryParam('#last-name', 'last_name');
            prefillFromQueryParam('#email', 'email');
            prefillFromQueryParam('#phone-number', 'phone');
            prefillFromQueryParam('#address', 'address');
            prefillFromQueryParam('#city', 'city');
            prefillFromQueryParam('#zip-code', 'zip');
        }
    }

    // NOVO: Preencher profissionais
    function fillProviders() {
        $selectProvider.empty();
        $selectProvider.append(new Option(lang('please_select'), ''));
        vars('available_providers').forEach((provider) => {
            $selectProvider.append(
                new Option(
                    (provider.first_name + ' ' + provider.last_name).trim(),
                    provider.id
                )
            );
        });
    }

    // NOVO: Preencher serviços do profissional selecionado
    function fillServicesByProvider(providerId) {
        $selectService.empty();
        $selectService.append(new Option(lang('please_select'), ''));
        if (!providerId) {
            $selectService.prop('disabled', true);
            return;
        }
        const provider = vars('available_providers').find(p => String(p.id) === String(providerId));
        if (!provider || !provider.services || !provider.services.length) {
            $selectService.prop('disabled', true);
            return;
        }
        vars('available_services').forEach((service) => {
            if (provider.services.includes(String(service.id)) || provider.services.includes(Number(service.id))) {
                $selectService.append(
                    new Option(service.name, service.id)
                );
            }
        });
        $selectService.prop('disabled', false);
    }

    function prefillFromQueryParam(field, param) {
        const $target = $(field);
        if (!$target.length) {
            return;
        }
        $target.val(App.Utils.Url.queryParam(param));
    }

    function optimizeContactInfoDisplay() {
        const $firstCol = $('#wizard-frame-3 .field-col:first');
        const $firstColControls = $firstCol.find('.form-control');
        const $secondCol = $('#wizard-frame-3 .field-col:last');
        const $secondColControls = $secondCol.find('.form-control');

        if ($firstColControls.length === 1 && $secondColControls.length > 1) {
            $firstColControls.each((index, controlEl) => {
                $(controlEl).parent().insertBefore($secondColControls.first().parent());
            });
        }

        if ($secondColControls.length === 1 && $firstColControls.length > 1) {
            $secondColControls.each((index, controlEl) => {
                $(controlEl).parent().insertAfter($firstColControls.last().parent());
            });
        }

        const $fieldCols = $(document).find('#wizard-frame-3 .field-col');
        $fieldCols.each((index, fieldColEl) => {
            const $fieldCol = $(fieldColEl);
            if (!$fieldCol.find('.form-control').length) {
                $fieldCol.hide();
            }
        });
    }

    function addEventListeners() {
        $selectTimezone.on('change', () => {
            const date = App.Utils.UI.getDateTimePickerValue($selectDate);
            if (!date) {
                return;
            }
            App.Http.Booking.getAvailableHours(moment(date).format('YYYY-MM-DD'));
            App.Pages.Booking.updateConfirmFrame();
        });

        // NOVO: Ao selecionar profissional, preenche serviços e mostra foto
        $selectProvider.on('change', function () {
            const providerId = $(this).val();
            fillServicesByProvider(providerId);
            updateProviderPhoto();

            // Atualiza datas indisponíveis
            const todayDateTimeObject = new Date();
            const todayDateTimeMoment = moment(todayDateTimeObject);
            App.Utils.UI.setDateTimePickerValue($selectDate, todayDateTimeObject);

            App.Http.Booking.getUnavailableDates(
                providerId,
                $selectService.val(),
                todayDateTimeMoment.format('YYYY-MM-DD'),
            );

            App.Pages.Booking.updateConfirmFrame();
        });

        // Ao selecionar serviço, atualiza datas indisponíveis e descrição
        $selectService.on('change', function () {
            const serviceId = $selectService.val();
            App.Http.Booking.getUnavailableDates(
                $selectProvider.val(),
                serviceId,
                moment(App.Utils.UI.getDateTimePickerValue($selectDate)).format('YYYY-MM-DD'),
            );
            App.Pages.Booking.updateConfirmFrame();
            App.Pages.Booking.updateServiceDescription(serviceId);
        });

        $('.button-next').on('click', (event) => {
            const $target = $(event.currentTarget);

            // Agora, exige profissional antes de avançar
            if ($target.attr('data-step_index') === '1' && !$selectProvider.val()) {
                return;
            }

            if ($target.attr('data-step_index') === '2') {
                if (!$('.selected-hour').length) {
                    if (!$('#select-hour-prompt').length) {
                        $('<div/>', {
                            'id': 'select-hour-prompt',
                            'class': 'text-danger mb-4',
                            'text': lang('appointment_hour_missing'),
                        }).prependTo('#available-hours');
                    }
                    return;
                }
            }

            if ($target.attr('data-step_index') === '3') {
                if (!App.Pages.Booking.validateCustomerForm()) {
                    return;
                } else {
                    App.Pages.Booking.updateConfirmFrame();
                }
            }

            const nextTabIndex = parseInt($target.attr('data-step_index')) + 1;

            $target
                .parents()
                .eq(1)
                .fadeOut(() => {
                    $('.active-step').removeClass('active-step');
                    $('#step-' + nextTabIndex).addClass('active-step');
                    $('#wizard-frame-' + nextTabIndex).fadeIn();
                });

            const scrollingElement = document.scrollingElement || document.body;
            if (window.innerHeight < scrollingElement.scrollHeight) {
                scrollingElement.scrollTop = 0;
            }
        });

        $('.button-back').on('click', (event) => {
            const prevTabIndex = parseInt($(event.currentTarget).attr('data-step_index')) - 1;

            $(event.currentTarget)
                .parents()
                .eq(1)
                .fadeOut(() => {
                    $('.active-step').removeClass('active-step');
                    $('#step-' + prevTabIndex).addClass('active-step');
                    $('#wizard-frame-' + prevTabIndex).fadeIn();
                });
        });

        $availableHours.on('click', '.available-hour', (event) => {
            $availableHours.find('.selected-hour').removeClass('selected-hour');
            $(event.target).addClass('selected-hour');
            App.Pages.Booking.updateConfirmFrame();
        });

        if (manageMode) {
            $('#cancel-appointment').on('click', () => {
                const $cancelAppointmentForm = $('#cancel-appointment-form');
                let $cancellationReason;
                const buttons = [
                    {
                        text: lang('close'),
                        click: (event, messageModal) => {
                            messageModal.hide();
                        },
                    },
                    {
                        text: lang('confirm'),
                        click: () => {
                            if ($cancellationReason.val() === '') {
                                $cancellationReason.css('border', '2px solid #DC3545');
                                return;
                            }
                            $cancelAppointmentForm.find('#hidden-cancellation-reason').val($cancellationReason.val());
                            $cancelAppointmentForm.submit();
                        },
                    },
                ];

                App.Utils.Message.show(
                    lang('cancel_appointment_title'),
                    lang('write_appointment_removal_reason'),
                    buttons,
                );

                $cancellationReason = $('<textarea/>', {
                    'class': 'form-control mt-2',
                    'id': 'cancellation-reason',
                    'rows': '3',
                    'css': {
                        'width': '100%',
                    },
                }).appendTo('#message-modal .modal-body');

                return false;
            });

            $deletePersonalInformation.on('click', () => {
                const buttons = [
                    {
                        text: lang('cancel'),
                        click: (event, messageModal) => {
                            messageModal.hide();
                        },
                    },
                    {
                        text: lang('delete'),
                        click: () => {
                            App.Http.Booking.deletePersonalInformation(vars('customer_token'));
                        },
                    },
                ];

                App.Utils.Message.show(
                    lang('delete_personal_information'),
                    lang('delete_personal_information_prompt'),
                    buttons,
                );
            });
        }

        $bookAppointmentSubmit.on('click', () => {
            const $acceptToTermsAndConditions = $('#accept-to-terms-and-conditions');
            $acceptToTermsAndConditions.removeClass('is-invalid');
            if ($acceptToTermsAndConditions.length && !$acceptToTermsAndConditions.prop('checked')) {
                $acceptToTermsAndConditions.addClass('is-invalid');
                return;
            }
            const $acceptToPrivacyPolicy = $('#accept-to-privacy-policy');
            $acceptToPrivacyPolicy.removeClass('is-invalid');
            if ($acceptToPrivacyPolicy.length && !$acceptToPrivacyPolicy.prop('checked')) {
                $acceptToPrivacyPolicy.addClass('is-invalid');
                return;
            }
            App.Http.Booking.registerAppointment();
        });

        $captchaTitle.on('click', 'button', () => {
            $('.captcha-image').attr('src', App.Utils.Url.siteUrl('captcha?' + Date.now()));
        });

        $selectDate.on('mousedown', '.ui-datepicker-calendar td', () => {
            setTimeout(() => {
                App.Http.Booking.applyPreviousUnavailableDates();
            }, 300);
        });
    }

    function validateCustomerForm() {
        $('#wizard-frame-3 .is-invalid').removeClass('is-invalid');
        $('#wizard-frame-3 label.text-danger').removeClass('text-danger');

        let missingRequiredField = false;

        $('.required').each((index, requiredField) => {
            if (!$(requiredField).val()) {
                $(requiredField).addClass('is-invalid');
                missingRequiredField = true;
            }
        });

        if (missingRequiredField) {
            $('#form-message').text(lang('fields_are_required'));
            return false;
        }

        if ($email.val() && !App.Utils.Validation.email($email.val())) {
            $email.addClass('is-invalid');
            $('#form-message').text(lang('invalid_email'));
            return false;
        }

        const phoneNumber = $phoneNumber.val();
        if (phoneNumber && !App.Utils.Validation.phone(phoneNumber)) {
            $phoneNumber.addClass('is-invalid');
            $('#form-message').text(lang('invalid_phone'));
            return false;
        }

        return true;
    }

    function updateConfirmFrame() {
        const serviceId = $selectService.val();
        const providerId = $selectProvider.val();

        $displayBookingSelection.text(`${lang('provider')} │ ${lang('service')}`);

        const serviceOptionText = serviceId ? $selectService.find('option:selected').text() : lang('service');
        const providerOptionText = providerId ? $selectProvider.find('option:selected').text() : lang('provider');

        if (serviceId || providerId) {
            $displayBookingSelection.text(`${providerOptionText} │ ${serviceOptionText}`);
        }

        if (!$availableHours.find('.selected-hour').text()) {
            return;
        }

        const service = vars('available_services').find(
            (availableService) => Number(availableService.id) === Number(serviceId),
        );

        if (!service) {
            return;
        }

        const selectedDateObject = App.Utils.UI.getDateTimePickerValue($selectDate);
        const selectedDateMoment = moment(selectedDateObject);
        const selectedDate = selectedDateMoment.format('YYYY-MM-DD');
        const selectedTime = $availableHours.find('.selected-hour').text();

        let formattedSelectedDate = '';

        if (selectedDateObject) {
            formattedSelectedDate =
                App.Utils.Date.format(selectedDate, vars('date_format'), vars('time_format'), false) +
                ' ' +
                selectedTime;
        }

        const timezoneOptionText = $selectTimezone.find('option:selected').text();

        $('#appointment-details').html(`
            <div>
                <div class="mb-2 fw-bold fs-3">
                    ${serviceOptionText}
                </div> 
                <div class="mb-2 fw-bold text-muted">
                    ${providerOptionText}
                </div>
                <div class="mb-2">
                    <i class="fas fa-calendar-day me-2"></i>
                    ${formattedSelectedDate}
                </div> 
                <div class="mb-2">
                    <i class="fas fa-clock me-2"></i>
                    ${service.duration} ${lang('minutes')}
                </div>
                <div class="mb-2">
                    <i class="fas fa-globe me-2"></i>
                    ${timezoneOptionText}
                </div> 
                <div class="mb-2" ${!Number(service.price) ? 'hidden' : ''}>
                    <i class="fas fa-cash-register me-2"></i>
                    ${Number(service.price).toFixed(2)} ${service.currency}
                </div>
            </div>     
        `);

        const firstName = App.Utils.String.escapeHtml($firstName.val());
        const lastName = App.Utils.String.escapeHtml($lastName.val());
        const fullName = `${firstName} ${lastName}`.trim();
        const email = App.Utils.String.escapeHtml($email.val());
        const phoneNumber = App.Utils.String.escapeHtml($phoneNumber.val());
        const address = App.Utils.String.escapeHtml($address.val());
        const city = App.Utils.String.escapeHtml($city.val());
        const zipCode = App.Utils.String.escapeHtml($zipCode.val());

        const addressParts = [];

        if (city) {
            addressParts.push(city);
        }

        if (zipCode) {
            addressParts.push(zipCode);
        }

        $('#customer-details').html(`
            <div>
                <div class="mb-2 fw-bold fs-3">
                    ${lang('contact_info')}
                </div>
                <div class="mb-2 fw-bold text-muted" ${!fullName ? 'hidden' : ''}>
                    ${fullName}
                </div>
                <div class="mb-2" ${!email ? 'hidden' : ''}>
                    ${email}
                </div>
                <div class="mb-2" ${!phoneNumber ? 'hidden' : ''}>
                    ${phoneNumber}
                </div>
                <div class="mb-2" ${!address ? 'hidden' : ''}>
                    ${address}
                </div>
                <div class="mb-2" ${!addressParts.length ? 'hidden' : ''}>
                    ${addressParts.join(', ')}
                </div>
            </div>
        `);

        const data = {};

        data.customer = {
            last_name: $lastName.val(),
            first_name: $firstName.val(),
            email: $email.val(),
            phone_number: $phoneNumber.val(),
            address: $address.val(),
            city: $city.val(),
            zip_code: $zipCode.val(),
            timezone: $selectTimezone.val(),
            custom_field_1: $customField1.val(),
            custom_field_2: $customField2.val(),
            custom_field_3: $customField3.val(),
            custom_field_4: $customField4.val(),
            custom_field_5: $customField5.val(),
        };

        data.appointment = {
            start_datetime:
                moment(App.Utils.UI.getDateTimePickerValue($selectDate)).format('YYYY-MM-DD') +
                ' ' +
                moment($('.selected-hour').data('value'), 'HH:mm').format('HH:mm') +
                ':00',
            end_datetime: calculateEndDatetime(),
            notes: $notes.val(),
            is_unavailability: false,
            id_users_provider: $selectProvider.val(),
            id_services: $selectService.val(),
        };

        data.manage_mode = Number(manageMode);

        if (manageMode) {
            data.appointment.id = vars('appointment_data').id;
            data.customer.id = vars('customer_data').id;
        }

        $('input[name="post_data"]').val(JSON.stringify(data));
    }

    function calculateEndDatetime() {
        const serviceId = $selectService.val();

        const service = vars('available_services').find(
            (availableService) => Number(availableService.id) === Number(serviceId),
        );

        const selectedDate = moment(App.Utils.UI.getDateTimePickerValue($selectDate)).format('YYYY-MM-DD');
        const selectedHour = $('.selected-hour').data('value');
        const startMoment = moment(selectedDate + ' ' + selectedHour);

        let endMoment;

        if (service.duration && startMoment) {
            endMoment = startMoment.clone().add({'minutes': parseInt(service.duration)});
        } else {
            endMoment = moment();
        }

        return endMoment.format('YYYY-MM-DD HH:mm:ss');
    }

    function applyAppointmentData(appointment, provider, customer) {
        try {
            $selectProvider.val(appointment.id_users_provider).trigger('change');
            $selectService.val(appointment.id_services);

            const startMoment = moment(appointment.start_datetime);
            App.Utils.UI.setDateTimePickerValue($selectDate, startMoment.toDate());
            App.Http.Booking.getAvailableHours(startMoment.format('YYYY-MM-DD'));

            App.Http.Booking.getUnavailableDates(
                appointment.id_users_provider,
                appointment.id_services,
                startMoment.format('YYYY-MM-DD'),
            );

            $lastName.val(customer.last_name);
            $firstName.val(customer.first_name);
            $email.val(customer.email);
            $phoneNumber.val(customer.phone_number);
            $address.val(customer.address);
            $city.val(customer.city);
            $zipCode.val(customer.zip_code);
            if (customer.timezone) {
                $selectTimezone.val(customer.timezone);
            }
            const appointmentNotes = appointment.notes !== null ? appointment.notes : '';
            $notes.val(appointmentNotes);

            $customField1.val(customer.custom_field_1);
            $customField2.val(customer.custom_field_2);
            $customField3.val(customer.custom_field_3);
            $customField4.val(customer.custom_field_4);
            $customField5.val(customer.custom_field_5);

            App.Pages.Booking.updateConfirmFrame();

            return true;
        } catch (exc) {
            return false;
        }
    }

    function updateServiceDescription(serviceId) {
        const $serviceDescription = $('#service-description');
        $serviceDescription.empty();

        const service = vars('available_services').find(
            (availableService) => Number(availableService.id) === Number(serviceId),
        );

        if (!service) {
            return;
        }

        const additionalInfoParts = [];

        if (service.duration) {
            additionalInfoParts.push(`${lang('duration')}: ${service.duration} ${lang('minutes')}`);
        }

        if (Number(service.price) > 0) {
            additionalInfoParts.push(`${lang('price')}: ${Number(service.price).toFixed(2)} ${service.currency}`);
        }

        if (service.location) {
            additionalInfoParts.push(`${lang('location')}: ${service.location}`);
        }

        if (additionalInfoParts.length) {
            $(`
                <div class="mb-2 fst-italic">
                    ${additionalInfoParts.join(', ')}
                </div>
            `).appendTo($serviceDescription);
        }

        if (service.description?.length) {
            const escapedDescription = App.Utils.String.escapeHtml(service.description);
            const multiLineDescription = escapedDescription.replaceAll('\n', '<br/>');
            $(`
                <div class="text-muted">
                    ${multiLineDescription}
                </div>
            `).appendTo($serviceDescription);
        }
    }

    document.addEventListener('DOMContentLoaded', initialize);

    return {
        manageMode,
        updateConfirmFrame,
        updateServiceDescription,
        validateCustomerForm,
    };
})();